import util from "util"
import fs from "fs"
import {imageSize} from "image-size"
import ffmpeg from "fluent-ffmpeg"
import path from "path"
import child_process from "child_process"
import GifEncoder from "gif-encoder"
import getPixels from "get-pixels"
import gifFrames from "gif-frames"

const exec = util.promisify(child_process.exec)

export type Waifu2xFormats =
    | "bmp"
    | "dib"
    | "exr"
    | "hdr"
    | "jpe"
    | "jpeg"
    | "jpg"
    | "pbm"
    | "pgm"
    | "pic"
    | "png"
    | "pnm"
    | "ppm"
    | "pxm"
    | "ras"
    | "sr"
    | "tif"
    | "tiff"
    | "webp"

export interface Waifu2xOptions {
    noise?: 0 | 1 | 2 | 3
    scale?: number
    mode?: "noise" | "scale" | "noise-scale"
    blockSize?: number
    pngCompression?: number
    jpgWebpQuality?: number
    disableGPU?: boolean
    forceOpenCL?: boolean
    processor?: number
    threads?: number
    recursive?: boolean
    modelDir?: string
    rename?: string
    waifu2xPath?: string
    webpPath?: string
    limit?: number
    parallelFrames?: number
}

export interface Waifu2xGIFOptions extends Waifu2xOptions {
    quality?: number
    speed?: number
    reverse?: boolean
    cumulative?: boolean
    transparency?: boolean
}

export interface Waifu2xAnimatedWebpOptions extends Waifu2xOptions {
    quality?: number
    speed?: number
    reverse?: boolean
    webpPath?: string
}

export interface Waifu2xVideoOptions extends Waifu2xOptions {
    framerate?: number
    quality?: number
    speed?: number
    reverse?: boolean
    pitch?: boolean
    ffmpegPath?: string
}

export default class Waifu2x {
    public static chmod777 = (waifu2xPath?: string, webpPath?: string) => {
        if (process.platform === "win32") return
        const waifu2x = waifu2xPath ? path.normalize(waifu2xPath).replace(/\\/g, "/") : path.join(__dirname, "../waifu2x")
        const webp = webpPath ? path.normalize(webpPath).replace(/\\/g, "/") : path.join(__dirname, "../webp")
        fs.chmodSync(`${waifu2x}/waifu2x-converter-cpp.app`, "777")
        fs.chmodSync(`${webp}/anim_dump.app`, "777")
        fs.chmodSync(`${webp}/cwebp.app`, "777")
        fs.chmodSync(`${webp}/dwebp.app`, "777")
        fs.chmodSync(`${webp}/img2webp.app`, "777")
    }

    private static parseFilename = (source: string, dest: string, rename: string) => {
        let [image, folder] = ["", ""]
        if (!dest) {
            image = null
            folder = null
        } else if (path.basename(dest).includes(".")) {
            image = path.basename(dest)
            folder = dest.replace(image, "")
        } else {
            image = null
            folder = dest
        }
        if (!folder) folder = "./"
        if (folder.endsWith("/")) folder = folder.slice(0, -1)
        if (!image) {
            image = `${path.basename(source, path.extname(source))}${rename}${path.extname(source)}`
        }
        return {folder, image}
    }

    private static recursiveRename = (folder: string, fileNames: string[], rename: string) => {
        if (folder.endsWith("/")) folder = folder.slice(0, -1)
        for (let i = 0; i < fileNames.length; i++) {
            const fullPath = `${folder}/${fileNames[i]}`
            const check = fs.statSync(fullPath)
            if (check.isDirectory()) {
                const subFiles = fs.readdirSync(fullPath)
                Waifu2x.recursiveRename(fullPath, subFiles, rename)
            } else {
                const pathSplit = fileNames[i].split(".")
                const newName = pathSplit?.[0].split("_")?.[0] + rename
                const newPath = `${folder}/${newName}.${pathSplit.pop()}`
                fs.renameSync(fullPath, newPath)
            }
        }
    }

    public static parseDest = (source: string, dest?: string, options?: {rename?: string}) => {
        if (!options) options = {}
        if (!dest) dest = "./"
        if (options.rename === undefined) options.rename = "2x"
        let {folder, image} = Waifu2x.parseFilename(source, dest, options.rename)
        if (!path.isAbsolute(source) && !path.isAbsolute(dest)) {
            let local = __dirname.includes("node_modules") ? path.join(__dirname, "../../../") : path.join(__dirname, "..")
            folder = path.join(local, folder)
        }
        return path.normalize(`${folder}/${image}`).replace(/\\/g, "/")
    }

    private static timeout = async (ms: number) => {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    public static convertToWebp = async (source: string, dest: string, webpPath?: string, quality?: number) => {
        if (!quality) quality = 75
        const absolute = webpPath ? path.normalize(webpPath).replace(/\\/g, "/") : path.join(__dirname, "../webp")
        let program = `cd "${absolute}" && cwebp.exe`
        if (process.platform === "darwin") program = `cd "${absolute}" && ./cwebp.app`
        let command = `${program} -q ${quality} "${source}" -o "${dest}"`
        const child = child_process.exec(command)
        await new Promise<void>((resolve, reject) => {
            child.on("close", () => resolve())
        })
        return dest
    }

    public static convertFromWebp = async (source: string, dest: string, webpPath?: string) => {
        const absolute = webpPath ? path.normalize(webpPath).replace(/\\/g, "/") : path.join(__dirname, "../webp")
        let program = `cd "${absolute}" && dwebp.exe`
        if (process.platform === "darwin") program = `cd "${absolute}" && ./dwebp.app`
        let command = `${program} "${source}" -o "${dest}"`
        const child = child_process.exec(command)
        let error = ""
        await new Promise<void>((resolve, reject) => {
            child.stderr.on("data", (chunk) => error += chunk)
            child.on("close", () => resolve())
        })
        if (error.includes("animated WebP")) return Promise.reject(error)
        return dest
    }

    public static upscaleImage = async (source: string, dest?: string, options?: Waifu2xOptions, action?: () => "stop" | void) => {
        if (!options) options = {}
        if (!dest) dest = "./"
        if (options.rename === undefined) options.rename = "2x"
        let sourcePath = source
        let {folder, image} = Waifu2x.parseFilename(source, dest, options.rename)
        if (!fs.existsSync(folder)) fs.mkdirSync(folder, {recursive: true})
        let local = __dirname.includes("node_modules") ? path.join(__dirname, "../../../") : path.join(__dirname, "..")
        if (!path.isAbsolute(source) && !path.isAbsolute(dest)) {
            sourcePath = path.join(local, source)
            folder = path.join(local, folder)
        }
        let destPath = path.join(folder, image).replace(/\\/g, "/")
        const absolute = options.waifu2xPath ? path.normalize(options.waifu2xPath).replace(/\\/g, "/") : path.join(__dirname, "../waifu2x")
        const buffer = fs.readFileSync(sourcePath)
        const dimensions = imageSize(buffer)
        if (dimensions.type === "webp") {
            try {
                await Waifu2x.convertFromWebp(sourcePath, destPath, options.webpPath)
                sourcePath = destPath
            } catch {
                return "animated webp"
            }
        }
        let program = `cd "${absolute}" && waifu2x-converter-cpp.exe`
        if (process.platform === "darwin") program = `cd "${absolute}" && ./waifu2x-converter-cpp.app --model-dir "./models_rgb"`
        let command = `${program} -i "${sourcePath}" -o "${destPath}" -s`
        if (options.noise) command += ` --noise-level ${options.noise}`
        if (options.scale) command +=  ` --scale-ratio ${options.scale}`
        if (options.mode) command += ` -m ${options.mode}`
        if (options.pngCompression) command += ` -c ${options.pngCompression}`
        if (options.jpgWebpQuality) command += ` -q ${options.jpgWebpQuality}`
        if (options.blockSize) command += ` --block-size ${options.blockSize}`
        if (options.disableGPU) command += ` --disable-gpu`
        if (options.forceOpenCL) command += ` --force-OpenCL`
        if (options.processor) command += ` -p ${options.processor}`
        if (options.threads) command += ` -j ${options.threads}`
        if (options.modelDir) {
            if (options.modelDir.endsWith("/")) options.modelDir = options.modelDir.slice(0, -1)
            if (!path.isAbsolute(options.modelDir)) options.modelDir = path.join(local, options.modelDir)
            command += ` --model-dir "${options.modelDir}"`
        }
        const child = child_process.exec(command)
        let stopped = false
        const poll = async () => {
            if (action() === "stop") {
                stopped = true
                child.stdio.forEach((s) => s.destroy())
                child.kill("SIGINT")
            }
            await Waifu2x.timeout(1000)
            if (!stopped) poll()
        }
        if (action) poll()
        let error = ""
        await new Promise<void>((resolve, reject) => {
            child.stderr.on("data", (chunk) => error += chunk)
            child.on("close", () => {
                stopped = true
                resolve()
            })
        })
        if (error) return Promise.reject(error)
        if (path.extname(destPath) === ".webp") {
            await Waifu2x.convertToWebp(destPath, destPath, options.webpPath, options.jpgWebpQuality)
        }
        return path.normalize(destPath).replace(/\\/g, "/") as string
    }

    private static recursiveSearch = (dir: string) => {
        const files = fs.readdirSync(dir)
        let fileMap = files.map((file) => `${dir}/${file}`).filter((f) => fs.lstatSync(f).isFile())
        const dirMap = files.map((file) => `${dir}/${file}`).filter((f) => fs.lstatSync(f).isDirectory())
        for (let i = 0; i < dirMap.length; i++) {
            const search = Waifu2x.recursiveSearch(dirMap[i])
            fileMap = [...fileMap, ...search]
        }
        return fileMap
    }

    public static upscaleImages = async (sourceFolder: string, destFolder?: string, options?: Waifu2xOptions, progress?: (current: number, total: number) => void | boolean) => {
        if (!options) options = {}
        const files = fs.readdirSync(sourceFolder)
        if (sourceFolder.endsWith("/")) sourceFolder = sourceFolder.slice(0, -1)
        let fileMap = files.map((file) => `${sourceFolder}/${file}`).filter((f) => fs.lstatSync(f).isFile())
        const dirMap = files.map((file) => `${sourceFolder}/${file}`).filter((f) => fs.lstatSync(f).isDirectory())
        if (options.recursive) {
            for (let i = 0; i < dirMap.length; i++) {
                const search = Waifu2x.recursiveSearch(dirMap[i])
                fileMap = [...fileMap, ...search]
            }
        }
        if (!options.limit) options.limit = fileMap.length
        const retArray: string[] = []
        let cancel = false
        let counter = 1
        let total = fileMap.length
        let queue: string[][] = []
        if (!options.parallelFrames) options.parallelFrames = 1
        while (fileMap.length) queue.push(fileMap.splice(0, options.parallelFrames))
        if (progress) progress(0, total)
        for (let i = 0; i < queue.length; i++) {
            await Promise.all(queue[i].map(async (f) => {
                if (counter >= options.limit) cancel = true
                const ret = await Waifu2x.upscaleImage(f, destFolder, options)
                retArray.push(ret)
                const stop = progress ? progress(counter++, total) : false
                if (stop) cancel = true
            }))
            if (cancel) break
        }
        return retArray
    }

    private static encodeGIF = async (files: string[], delays: number[], dest: string, quality?: number, transparency?: boolean) => {
        if (!quality) quality = 10
        return new Promise<void>((resolve) => {
            const dimensions = imageSize(files?.[0])
            const gif = new GifEncoder(dimensions.width, dimensions.height, {highWaterMark: 5 * 1024 * 1024})
            const file = fs.createWriteStream(dest)
            gif.pipe(file)
            gif.setQuality(quality)
            gif.setRepeat(0)
            gif.writeHeader()
            if (transparency) gif.setTransparent(true)
            let counter = 0

            const addToGif = (frames: string[]) => {
                getPixels(frames[counter], function(err: Error, pixels: any) {
                    gif.read(1024 * 1024)
                    gif.setDelay(10 * delays[counter])
                    gif.addFrame(pixels.data)
                    if (counter >= frames.length - 1) {
                        gif.finish()
                    } else {
                        counter++
                        addToGif(files)
                    }
                })
            }
            addToGif(files)
            gif.on("end", () => {
                    resolve()
                })
            })
    }

    private static awaitStream = async (writeStream: NodeJS.WritableStream) => {
        return new Promise((resolve, reject) => {
            writeStream.on("finish", resolve)
            writeStream.on("error", reject)
        })
    }

    private static newDest = (dest: string) => {
        let i = 1
        let newDest = dest
        while (fs.existsSync(newDest)) {
            newDest = `${dest}_${i}`
            i++
        }
        return newDest
    }

    private static findMatchingSettings = (dest: string, options: any) => {
        let i = 1
        let newDest = dest
        if (fs.existsSync(newDest)) {  
            const settings = JSON.parse(fs.readFileSync(`${newDest}/settings.json`, "utf8"))
            if (JSON.stringify(settings) === JSON.stringify(options)) {
                return newDest
            }
        }
        newDest = `${dest}_${i}`
        while (fs.existsSync(newDest) || i < 10) {
            if (fs.existsSync(newDest)) {    
                const settings = JSON.parse(fs.readFileSync(`${newDest}/settings.json`, "utf8"))
                if (JSON.stringify(settings) === JSON.stringify(options)) {
                    return newDest
                }
            }
            i++
            newDest = `${dest}_${i}`
        }
        return null
    }

    public static upscaleGIF = async (source: string, dest?: string, options?: Waifu2xGIFOptions, progress?: (current: number, total: number) => void | boolean) => {
        if (!options) options = {}
        if (!dest) dest = "./"
        if (!options.cumulative) options.cumulative = false
        const frames = await gifFrames({url: source, frames: "all", outputType: "png", cumulative: options.cumulative})
        let {folder, image} = Waifu2x.parseFilename(source, dest, "2x")
        if (!path.isAbsolute(source) && !path.isAbsolute(dest)) {
            let local = __dirname.includes("node_modules") ? path.join(__dirname, "../../../") : path.join(__dirname, "..")
            folder = path.join(local, folder)
        }
        let frameDest = `${folder}/${path.basename(source, path.extname(source))}Frames`
        let resume = 0
        if (fs.existsSync(frameDest)) {
            const matching = Waifu2x.findMatchingSettings(frameDest, options)
            if (matching) {
                frameDest = matching
                resume = fs.readdirSync(`${frameDest}/upscaled`).length
            } else {
                frameDest = Waifu2x.newDest(frameDest)
                fs.mkdirSync(frameDest, {recursive: true})
                fs.writeFileSync(`${frameDest}/settings.json`, JSON.stringify(options))
            }
        } else {
            fs.mkdirSync(frameDest, {recursive: true})
            fs.writeFileSync(`${frameDest}/settings.json`, JSON.stringify(options))
        }
        const constraint = options.speed > 1 ? frames.length / options.speed : frames.length
        let step = Math.ceil(frames.length / constraint)
        let frameArray: string[] = []
        let delayArray: number[] = []
        async function downloadFrames(frames: any) {
            const promiseArray = []
            for (let i = 0; i < frames.length; i += step) {
                const writeStream = fs.createWriteStream(`${frameDest}/frame${i}.png`)
                frames[i].getImage().pipe(writeStream)
                frameArray.push(`${frameDest}/frame${i}.png`)
                delayArray.push(frames[i].frameInfo.delay)
                promiseArray.push(Waifu2x.awaitStream(writeStream))
            }
            return Promise.all(promiseArray)
        }
        await downloadFrames(frames)
        if (options.speed < 1) delayArray = delayArray.map((n) => n / options.speed)
        const upScaleDest = `${frameDest}/upscaled`
        if (!fs.existsSync(upScaleDest)) fs.mkdirSync(upScaleDest, {recursive: true})
        options.rename = ""
        let scaledFrames = fs.readdirSync(upScaleDest).map((f) => `${upScaleDest}/${path.basename(f)}`)
        let cancel = false
        if (options.scale !== 1) {
            let counter = resume
            let total = frameArray.length
            let queue: string[][] = []
            if (!options.parallelFrames) options.parallelFrames = 1
            frameArray = frameArray.slice(resume)
            while (frameArray.length) queue.push(frameArray.splice(0, options.parallelFrames))
            if (progress) progress(counter++, total)
            for (let i = 0; i < queue.length; i++) {
                await Promise.all(queue[i].map(async (f) => {
                    const destPath = await Waifu2x.upscaleImage(f, `${upScaleDest}/${path.basename(f)}`, options)
                    scaledFrames.push(destPath)
                    const stop = progress ? progress(counter++, total) : false
                    if (stop) cancel = true
                }))
                if (cancel) break
            }
        } else {
            scaledFrames = frameArray
        }
        scaledFrames = scaledFrames.sort(new Intl.Collator(undefined, {numeric: true, sensitivity: "base"}).compare)
        if (options.reverse) {
            scaledFrames = scaledFrames.reverse()
            delayArray = delayArray.reverse()
        }
        const finalDest = path.join(folder, image)
        await Waifu2x.encodeGIF(scaledFrames, delayArray, finalDest, options.quality, options.transparency)
        if (!cancel) Waifu2x.removeDirectory(frameDest)
        return path.normalize(finalDest).replace(/\\/g, "/")
    }

    public static upscaleGIFs = async (sourceFolder: string, destFolder?: string, options?: Waifu2xGIFOptions, totalProgress?: (current: number, total: number) => void | boolean, progress?: (current: number, total: number) => void | boolean) => {
        if (!options) options = {}
        const files = fs.readdirSync(sourceFolder)
        if (sourceFolder.endsWith("/")) sourceFolder = sourceFolder.slice(0, -1)
        const fileMap = files.map((file) => `${sourceFolder}/${file}`)
        if (!options.limit) options.limit = fileMap.length
        const retArray: string[] = []
        if (totalProgress) totalProgress(0, options.limit)
        for (let i = 0; i < options.limit; i++) {
            if (!fileMap[i]) break
            try {
                const ret = await Waifu2x.upscaleGIF(fileMap[i], destFolder, options, progress)
                const stop = totalProgress ? totalProgress(i + 1, options.limit) : false
                retArray.push(ret)
                if (stop) break
            } catch (err) {
                continue
            }
        }
        return retArray
    }

    private static dumpWebpFrames = async (source: string, frameDest?: string, webpPath?: string) => {
        const absolute = webpPath ? path.normalize(webpPath).replace(/\\/g, "/") : path.join(__dirname, "../webp")
        let program = `cd "${absolute}" && anim_dump.exe`
        if (process.platform === "darwin") program = `cd "${absolute}" && ./anim_dump.app`
        let command = `${program} -folder "${frameDest}" -prefix "frame" "${source}"`
        const child = child_process.exec(command)
        await new Promise<void>((resolve, reject) => {
            child.on("close", () => resolve())
        })
        return fs.readdirSync(frameDest).sort(new Intl.Collator(undefined, {numeric: true, sensitivity: "base"}).compare)
        .filter((s) => s !== "settings.json")
    }

    private static encodeAnimatedWebp = async (files: string[], dest: string, webpPath?: string) => {
        const frames = files.map((f) => `"${f}" -d 100`).join(" ")
        const absolute = webpPath ? path.normalize(webpPath).replace(/\\/g, "/") : path.join(__dirname, "../webp")
        let program = `cd "${absolute}" && img2webp.exe`
        if (process.platform === "darwin") program = `cd "${absolute}" && ./img2webp.app`
        let command = `${program} -loop "0" ${frames} -o "${dest}"`
        const child = child_process.exec(command)
        let error = ""
        await new Promise<void>((resolve, reject) => {
            child.stderr.on("data", (chunk) => error += chunk)
            child.on("close", () => resolve())
        })
        return dest
    }

    public static upscaleAnimatedWebp = async (source: string, dest?: string, options?: Waifu2xGIFOptions, progress?: (current: number, total: number) => void | boolean) => {
        if (!options) options = {}
        if (!dest) dest = "./"
        let {folder, image} = Waifu2x.parseFilename(source, dest, "2x")
        if (!path.isAbsolute(source) && !path.isAbsolute(dest)) {
            let local = __dirname.includes("node_modules") ? path.join(__dirname, "../../../") : path.join(__dirname, "..")
            folder = path.join(local, folder)
            source = path.join(local, source)
        }
        let frameDest = `${folder}/${path.basename(source, path.extname(source))}Frames`
        let resume = 0
        if (fs.existsSync(frameDest)) {
            const matching = Waifu2x.findMatchingSettings(frameDest, options)
            if (matching) {
                frameDest = matching
                resume = fs.readdirSync(`${frameDest}/upscaled`).length
            } else {
                frameDest = Waifu2x.newDest(frameDest)
                fs.mkdirSync(frameDest, {recursive: true})
                fs.writeFileSync(`${frameDest}/settings.json`, JSON.stringify(options))
            }
        } else {
            fs.mkdirSync(frameDest, {recursive: true})
            fs.writeFileSync(`${frameDest}/settings.json`, JSON.stringify(options))
        }
        let frames = await Waifu2x.dumpWebpFrames(source, frameDest, options.webpPath)
        const constraint = options.speed > 1 ? frames.length / options.speed : frames.length
        let step = Math.ceil(frames.length / constraint)
        let frameArray: string[] = []
        for (let i = 0; i < frames.length; i += step) {
            frameArray.push(`${frameDest}/${frames[i]}`)
        }
        // if (options.speed < 1) delayArray = delayArray.map((n) => n / options.speed)
        const upScaleDest = `${frameDest}/upscaled`
        if (!fs.existsSync(upScaleDest)) fs.mkdirSync(upScaleDest, {recursive: true})
        options.rename = ""
        let scaledFrames = fs.readdirSync(upScaleDest).map((f) => `${upScaleDest}/${path.basename(f)}`)
        let cancel = false
        if (options.scale !== 1) {
            let counter = resume
            let total = frameArray.length
            let queue: string[][] = []
            if (!options.parallelFrames) options.parallelFrames = 1
            frameArray = frameArray.slice(resume)
            while (frameArray.length) queue.push(frameArray.splice(0, options.parallelFrames))
            if (progress) progress(counter++, total)
            for (let i = 0; i < queue.length; i++) {
                await Promise.all(queue[i].map(async (f) => {
                    const destPath = await Waifu2x.upscaleImage(f, `${upScaleDest}/${path.basename(f)}`, options)
                    scaledFrames.push(destPath)
                    const stop = progress ? progress(counter++, total) : false
                    if (stop) cancel = true
                }))
                if (cancel) break
            }
        } else {
            scaledFrames = frameArray
        }
        scaledFrames = scaledFrames.sort(new Intl.Collator(undefined, {numeric: true, sensitivity: "base"}).compare)
        if (options.reverse) {
            scaledFrames = scaledFrames.reverse()
            // delayArray = delayArray.reverse()
        }
        const finalDest = path.join(folder, image)
        await Waifu2x.encodeAnimatedWebp(scaledFrames, finalDest, options.webpPath)
        if (!cancel) Waifu2x.removeDirectory(frameDest)
        return path.normalize(finalDest).replace(/\\/g, "/")
    }

    public static upscaleAnimatedWebps = async (sourceFolder: string, destFolder?: string, options?: Waifu2xAnimatedWebpOptions, totalProgress?: (current: number, total: number) => void | boolean, progress?: (current: number, total: number) => void | boolean) => {
        if (!options) options = {}
        const files = fs.readdirSync(sourceFolder)
        if (sourceFolder.endsWith("/")) sourceFolder = sourceFolder.slice(0, -1)
        const fileMap = files.map((file) => `${sourceFolder}/${file}`)
        if (!options.limit) options.limit = fileMap.length
        const retArray: string[] = []
        if (totalProgress) totalProgress(0, options.limit)
        for (let i = 0; i < options.limit; i++) {
            if (!fileMap[i]) break
            try {
                const ret = await Waifu2x.upscaleAnimatedWebp(fileMap[i], destFolder, options, progress)
                const stop = totalProgress ? totalProgress(i + 1, options.limit) : false
                retArray.push(ret)
                if (stop) break
            } catch (err) {
                continue
            }
        }
        return retArray
    }

    public static parseFramerate = async (file: string, ffmpegPath?: string) => {
        let command = `"${ffmpegPath ? ffmpegPath : "ffmpeg"}" -i "${file}"`
        const str = await exec(command).then((s: any) => s.stdout).catch((e: any) => e.stderr)
        const fps = Number(str.match(/[0-9.]+ (?=fps,)/)?.[0])
        return Number.isNaN(fps) ? 0 : fps
    }

    public static parseDuration = async (file: string, ffmpegPath?: string) => {
        let command = `"${ffmpegPath ? ffmpegPath : "ffmpeg"}" -i "${file}"`
        const str = await exec(command).then((s: any) => s.stdout).catch((e: any) => e.stderr)
        const tim =  str.match(/(?<=Duration: )(.*?)(?=,)/)[0].split(":").map((n: string) => Number(n))
        const dur =  (tim?.[0] * 60 * 60) + (tim?.[1] * 60) + tim?.[2]
        return Number.isNaN(dur) ? 0 : dur
    }

    public static parseResolution = async (file: string, ffmpegPath?: string) => {
        let command = `"${ffmpegPath ? ffmpegPath : "ffmpeg"}" -i "${file}"`
        const str = await exec(command).then((s: any) => s.stdout).catch((e: any) => e.stderr)
        const dim = str.match(/(?<= )\d+x\d+(?= |,)/)[0].split("x")
        let width = Number(dim?.[0])
        let height = Number(dim?.[1])
        if (Number.isNaN(width)) width = 0
        if (Number.isNaN(height)) height = 0
        return {width, height}
    }

    public static upscaleVideo = async (source: string, dest?: string, options?: Waifu2xVideoOptions, progress?: (current: number, total: number) => void | boolean) => {
        if (!options) options = {}
        if (!dest) dest = "./"
        if (options.ffmpegPath) ffmpeg.setFfmpegPath(options.ffmpegPath)
        let {folder, image} = Waifu2x.parseFilename(source, dest, "2x")
        if (!path.isAbsolute(source) && !path.isAbsolute(dest)) {
            let local = __dirname.includes("node_modules") ? path.join(__dirname, "../../../") : path.join(__dirname, "..")
            folder = path.join(local, folder)
            source = path.join(local, source)
        }
        let duration = await Waifu2x.parseDuration(source, options.ffmpegPath)
        if (!options.framerate) options.framerate = await Waifu2x.parseFramerate(source, options.ffmpegPath)
        let frameDest = `${folder}/${path.basename(source, path.extname(source))}Frames`
        let resume = 0
        if (fs.existsSync(frameDest)) {
            const matching = Waifu2x.findMatchingSettings(frameDest, options)
            if (matching) {
                frameDest = matching
                resume = fs.readdirSync(`${frameDest}/upscaled`).length
            } else {
                frameDest = Waifu2x.newDest(frameDest)
                fs.mkdirSync(frameDest, {recursive: true})
                fs.writeFileSync(`${frameDest}/settings.json`, JSON.stringify(options))
            }
        } else {
            fs.mkdirSync(frameDest, {recursive: true})
            fs.writeFileSync(`${frameDest}/settings.json`, JSON.stringify(options))
        }
        let framerate = ["-r", `${options.framerate}`]
        let crf = options.quality ? ["-crf", `${options.quality}`] : ["-crf", "16"]
        let codec = ["-vcodec", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart"]
        let audio = `${frameDest}/audio.wav`
        if (resume === 0) {
            await new Promise<void>((resolve) => {
                ffmpeg(source).outputOptions([...framerate])
                .save(`${frameDest}/frame%d.png`)
                .on("end", () => resolve())
            })
            await new Promise<void>((resolve, reject) => {
                ffmpeg(source).outputOptions("-bitexact").save(audio)
                .on("end", () => resolve())
                .on("error", () => reject())
            }).catch(() => audio = "")
        }
        let upScaleDest = `${frameDest}/upscaled`
        if (!fs.existsSync(upScaleDest)) fs.mkdirSync(upScaleDest, {recursive: true})
        options.rename = ""
        let frameArray = fs.readdirSync(frameDest).map((f) => `${frameDest}/${f}`).filter((f) => path.extname(f) === ".png")
        frameArray = frameArray.sort(new Intl.Collator(undefined, {numeric: true, sensitivity: "base"}).compare)
        let scaledFrames = fs.readdirSync(upScaleDest).map((f) => `${upScaleDest}/${path.basename(f)}`)
        let cancel = false
        if (options.scale !== 1) {
            let counter = resume
            let total = frameArray.length
            let queue: string[][] = []
            if (!options.parallelFrames) options.parallelFrames = 1
            frameArray = frameArray.slice(resume)
            while (frameArray.length) queue.push(frameArray.splice(0, options.parallelFrames))
            if (progress) progress(counter++, total)
            for (let i = 0; i < queue.length; i++) {
                await Promise.all(queue[i].map(async (f) => {
                    const destPath = await Waifu2x.upscaleImage(f, `${upScaleDest}/${path.basename(f)}`, options)
                    scaledFrames.push(destPath)
                    const stop = progress ? progress(counter++, total) : false
                    if (stop) cancel = true
                }))
                if (cancel) break
            }
        } else {
            scaledFrames = frameArray
            upScaleDest = frameDest
        }
        scaledFrames = scaledFrames.sort(new Intl.Collator(undefined, {numeric: true, sensitivity: "base"}).compare)
        let tempDest = `${upScaleDest}/temp.mp4`
        let finalDest = path.join(folder, image)
        let crop = "crop=trunc(iw/2)*2:trunc(ih/2)*2"
        if (!options.speed) options.speed = 1
        if (!options.reverse) options.reverse = false
        if (audio) {
            let filter: string[] = ["-vf", `${crop}`]
            await new Promise<void>((resolve) => {
                ffmpeg(`${upScaleDest}/frame%d.png`).input(audio).outputOptions([...framerate, ...codec, ...crf, ...filter])
                .save(`${upScaleDest}/${image}`)
                .on("end", () => resolve())
            })
            if (options.speed === 1 && !options.reverse) {
                tempDest = `${upScaleDest}/${image}`
            } else {
                let audioSpeed = options.pitch ? `asetrate=44100*${options.speed},aresample=44100` : `atempo=${options.speed}`
                filter = ["-filter_complex", `[0:v]setpts=${1.0/options.speed}*PTS${options.reverse ? ",reverse": ""}[v];[0:a]${audioSpeed}${options.reverse ? ",areverse" : ""}[a]`, "-map", "[v]", "-map", "[a]"]
                await new Promise<void>((resolve) => {
                    ffmpeg(`${upScaleDest}/${image}`).outputOptions([...framerate, ...codec, ...crf, ...filter])
                    .save(tempDest)
                    .on("end", () => resolve())
                })
            }
        } else {
            let filter = ["-filter_complex", `[0:v]${crop},setpts=${1.0/options.speed}*PTS${options.reverse ? ",reverse": ""}[v]`, "-map", "[v]"]
            await new Promise<void>((resolve) => {
                ffmpeg(`${upScaleDest}/frame%d.png`).outputOptions([...framerate, ...codec, ...crf, ...filter])
                .save(tempDest)
                .on("end", () => resolve())
            })
        }
        let newDuration = await Waifu2x.parseDuration(tempDest, options.ffmpegPath)
        let factor = duration / options.speed / newDuration
        if (Number.isNaN(factor)) factor = 1 
        let filter = ["-filter_complex", `[0:v]setpts=${factor}*PTS[v]`, "-map", "[v]"]
        if (audio) filter = ["-filter_complex", `[0:v]setpts=${factor}*PTS[v];[0:a]atempo=1[a]`, "-map", "[v]", "-map", "[a]"]
        let error = ""
        await new Promise<void>((resolve, reject) => {
            ffmpeg(tempDest).outputOptions([...framerate, ...codec, ...crf, ...filter])
            .save(finalDest)
            .on("end", () => resolve())
            .on("error", (e) => {
                error = e
                resolve()
            })
        })
        if (error) return Promise.reject(error)
        if (!cancel) Waifu2x.removeDirectory(frameDest)
        return path.normalize(finalDest).replace(/\\/g, "/")
    }

    public static upscaleVideos = async (sourceFolder: string, destFolder?: string, options?: Waifu2xVideoOptions, totalProgress?: (current: number, total: number) => void | boolean, progress?: (current: number, total: number) => void | boolean) => {
        if (!options) options = {}
        const files = fs.readdirSync(sourceFolder)
        if (sourceFolder.endsWith("/")) sourceFolder = sourceFolder.slice(0, -1)
        const fileMap = files.map((file) => `${sourceFolder}/${file}`)
        if (!options.limit) options.limit = fileMap.length
        const retArray: string[] = []
        if (totalProgress) totalProgress(0, options.limit)
        for (let i = 0; i < options.limit; i++) {
            if (!fileMap[i]) break
            try {
                const ret = await Waifu2x.upscaleVideo(fileMap[i], destFolder, options, progress)
                const stop = totalProgress ? totalProgress(i + 1, options.limit) : false
                retArray.push(ret)
                if (stop) break
            } catch (err) {
                continue
            }
        }
        return retArray
    }

    private static removeDirectory = (dir: string) => {
        if (!fs.existsSync(dir)) return
        fs.readdirSync(dir).forEach((file) => {
            const current = path.join(dir, file)
            if (fs.lstatSync(current).isDirectory()) {
                Waifu2x.removeDirectory(current)
            } else {
                fs.unlinkSync(current)
            }
        })
        try {
            fs.rmdirSync(dir)
        } catch (error) {
            console.log(error)
        }
    }
}

module.exports.default = Waifu2x
