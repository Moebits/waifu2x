import util from "util"
import fs from "fs"
import {imageSize} from "image-size"
import ffmpeg from "fluent-ffmpeg"
import path from "path"
import child_process, {ChildProcess} from "child_process"
import GifEncoder from "gif-encoder"
import getPixels from "get-pixels"
import gifFrames from "gif-frames"
import rife from "rife-fps"

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
    upscaler?: "waifu2x" | "real-esrgan" | "real-cugan" | string
    esrganPath?: string
    cuganPath?: string
    scriptsPath?: string
    pngFrames?: boolean
    rifePath?: string
}

export interface Waifu2xGIFOptions extends Waifu2xOptions {
    quality?: number
    speed?: number
    reverse?: boolean
    transparentColor?: string
    noResume?: boolean
}

export interface Waifu2xAnimatedWebpOptions extends Waifu2xOptions {
    quality?: number
    speed?: number
    reverse?: boolean
    webpPath?: string
    noResume?: boolean
}

export interface Waifu2xVideoOptions extends Waifu2xOptions {
    framerate?: number
    quality?: number
    speed?: number
    reverse?: boolean
    pitch?: boolean
    ffmpegPath?: string
    sdColorSpace?: boolean
    noResume?: boolean
    fpsMultiplier?: number
}

export default class Waifu2x {

    static processes: ChildProcess[] = []

    public static chmod777 = (waifu2xPath?: string, webpPath?: string, esrganPath?: string, cuganPath?: string, rifePath?: string) => {
        if (process.platform === "win32") return
        const waifu2x = waifu2xPath ? path.normalize(waifu2xPath).replace(/\\/g, "/") : path.join(__dirname, "../waifu2x")
        const esrgan = esrganPath ? path.normalize(esrganPath).replace(/\\/g, "/") : path.join(__dirname, "../real-esrgan")
        const cugan = cuganPath ? path.normalize(cuganPath).replace(/\\/g, "/") : path.join(__dirname, "../real-cugan")
        const webp = webpPath ? path.normalize(webpPath).replace(/\\/g, "/") : path.join(__dirname, "../webp")
        fs.chmodSync(`${waifu2x}/waifu2x-ncnn-vulkan.app`, "777")
        fs.chmodSync(`${esrgan}/realesrgan-ncnn-vulkan.app`, "777")
        fs.chmodSync(`${cugan}/realcugan-ncnn-vulkan.app`, "777")
        fs.chmodSync(`${webp}/anim_dump.app`, "777")
        fs.chmodSync(`${webp}/cwebp.app`, "777")
        fs.chmodSync(`${webp}/dwebp.app`, "777")
        fs.chmodSync(`${webp}/img2webp.app`, "777")
        fs.chmodSync(`${webp}/webpmux.app`, "777")
        rife.chmod777(rifePath)
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
        options = {...options}
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
        if (process.platform === "linux") program = `cd "${absolute}" && ./cwebp`
        let command = `${program} -q ${quality} "${source}" -o "${dest}"`
        const child = child_process.exec(command)
        Waifu2x.addProcess(child)
        //TODO add error handling
        await new Promise<void>((resolve, reject) => {
            child.on("close", () => {
                Waifu2x.removeProcess(child)
                resolve()
            })
        })
        return dest
    }
    private static addProcess = (process: child_process.ChildProcess) => {
        Waifu2x.processes.push(process)
    }
    private static removeProcess = (process: child_process.ChildProcess) => {
        Waifu2x.processes = Waifu2x.processes.filter((p) => p.pid !== process.pid)
    }
    public static convertFromWebp = async (source: string, dest: string, webpPath?: string) => {
        const absolute = webpPath ? path.normalize(webpPath).replace(/\\/g, "/") : path.join(__dirname, "../webp")
        let program = `cd "${absolute}" && dwebp.exe`
        if (process.platform === "darwin") program = `cd "${absolute}" && ./dwebp.app`
        if (process.platform === "linux") program = `cd "${absolute}" && ./dwebp`
        let command = `${program} "${source}" -o "${dest}"`
        const child = child_process.exec(command)
        Waifu2x.addProcess(child)
        let error = ""
        await new Promise<void>((resolve, reject) => {
            child.stderr.on("data", (chunk) => error += chunk)
            child.on("close", () => {
                Waifu2x.removeProcess(child)
                resolve()
            })
        })
        if (error.includes("animated WebP")) return Promise.reject(error)
        return dest
    }

    public static upscaleImage = async (source: string, dest?: string, options?: Waifu2xOptions, progress?: (percent?: number) => void | boolean) => {
        options = {...options}
        if (!dest) dest = "./"
        if (!options.upscaler) options.upscaler = "waifu2x"
        let sourcePath = source
        if (options.rename === undefined) options.rename = "2x"
        let {folder, image} = Waifu2x.parseFilename(source, dest, options.rename)

        if (!fs.existsSync(folder)) fs.mkdirSync(folder, {recursive: true})

        let local = __dirname.includes("node_modules") ? path.join(__dirname, "../../../") : path.join(__dirname, "..")
        if (!path.isAbsolute(source) && !path.isAbsolute(dest)) {
            sourcePath = path.join(local, source)
            folder = path.join(local, folder)
        }
        let destPath = path.join(folder, image).replace(/\\/g, "/")
        let absolute = ""
        if (options.upscaler === "waifu2x") {
            absolute = options.waifu2xPath ? path.normalize(options.waifu2xPath).replace(/\\/g, "/") : path.join(__dirname, "../waifu2x")
        } else if (options.upscaler === "real-esrgan") {
            absolute = options.esrganPath ? path.normalize(options.esrganPath).replace(/\\/g, "/") : path.join(__dirname, "../real-esrgan")
        } else if (options.upscaler === "real-cugan") {
            absolute = options.cuganPath ? path.normalize(options.cuganPath).replace(/\\/g, "/") : path.join(__dirname, "../real-cugan")
        } else {
            absolute = options.scriptsPath ? path.normalize(options.scriptsPath).replace(/\\/g, "/") : path.join(__dirname, "../scripts")
        }
        const buffer = fs.readFileSync(sourcePath)
        const dimensions = imageSize(buffer)
        if (dimensions.type === "webp") {
            try {
                await Waifu2x.convertFromWebp(sourcePath, destPath, options.webpPath)
                sourcePath = destPath
            } catch (error) {
                return Promise.reject(`Animated webp: ${error}`)
            }
        }
        let command = ""
        if (options.upscaler === "waifu2x") {
            let program = `cd "${absolute}" && waifu2x-ncnn-vulkan.exe`
            if (process.platform === "darwin") program = `cd "${absolute}" && ./waifu2x-ncnn-vulkan.app`
            if (process.platform === "linux") program = `cd "${absolute}" && ./waifu2x-ncnn-vulkan`
            const ext = path.extname(source).replace(".", "")
            command = `${program} -i "${sourcePath}" -o "${destPath}" -f ${ext}`
            if (options.scale) command +=  ` -s ${options.scale}`
            if (options.threads) command += ` -j ${options.threads}:${options.threads}:${options.threads}`
            if (options.modelDir) command += ` -m "${options.modelDir}"`
        } else if (options.upscaler === "real-esrgan") {
            let program = `cd "${absolute}" && realesrgan-ncnn-vulkan.exe`
            if (process.platform === "darwin") program = `cd "${absolute}" && ./realesrgan-ncnn-vulka.app`
            if (process.platform === "linux") program = `cd "${absolute}" && ./realesrgan-ncnn-vulkan`
            const ext = path.extname(source).replace(".", "")
            command = `${program} -i "${sourcePath}" -o "${destPath}" -f ${ext} -n ${options.scale === 4 ? "realesrgan-x4plus-anime" : "realesr-animevideov3"}`
            if (options.scale) command +=  ` -s ${options.scale}`
            if (options.threads) command += ` -j ${options.threads}:${options.threads}:${options.threads}`
        } else if (options.upscaler === "real-cugan") {
            let program = `cd "${absolute}" && realcugan-ncnn-vulkan.exe`
            if (process.platform === "darwin") program = `cd "${absolute}" && ./realcugan-ncnn-vulkan.app`
            if (process.platform === "linux") program = `cd "${absolute}" && ./realcugan-ncnn-vulkan`
            const ext = path.extname(source).replace(".", "")
            command = `${program} -i "${sourcePath}" -o "${destPath}" -f ${ext}`
            if (options.noise) command += ` -n ${options.noise}`
            if (options.scale) command +=  ` -s ${options.scale}`
            if (options.threads) command += ` -j ${options.threads}:${options.threads}:${options.threads}`
        } else {
            let program = `cd "${absolute}" && python3 upscale.py`
            command = `${program} -i "${sourcePath}" -o "${destPath}" -m "${options.upscaler}"`
        }
        const child = child_process.exec(command)
        Waifu2x.addProcess(child)
        let stopped = false
        const poll = async () => {
            if (progress()) {
                stopped = true
                child.stdio.forEach((s) => s.destroy())
                child.kill("SIGINT")
            }
            await Waifu2x.timeout(1000)
            if (!stopped) poll()
        }
        if (progress) poll()
        let error = ""
        await new Promise<void>((resolve, reject) => {
            child.stderr.on("data", (chunk) => {
                if (options.upscaler === "real-esrgan") {
                    const percent = Number(chunk.replace("%", "").replace(",", "."))
                    if (!Number.isNaN(percent)) progress?.(percent)
                }
            })
            child.on("close", () => {
                stopped = true
                Waifu2x.removeProcess(child)
                resolve()
            })
        })
        if (error) return Promise.reject(error)
        if (path.extname(destPath) === ".webp") {
            await Waifu2x.convertToWebp(destPath, destPath, options.webpPath, options.jpgWebpQuality)
        }
        return path.normalize(destPath).replace(/\\/g, "/") as string
    }

    private static searchFiles = (dir: string, recursive = false) => {
        const files = fs.readdirSync(dir)
        const fileMap = files.map((file) => `${dir}/${file}`).filter((f) => fs.lstatSync(f).isFile())
        if (!recursive) return fileMap
        const dirMap = files.map((file) => `${dir}/${file}`).filter((f) => fs.lstatSync(f).isDirectory())
        return fileMap.concat(dirMap.flatMap((dirEntry) => Waifu2x.searchFiles(dirEntry, true)))
    }

    public static upscaleImages = async (sourceFolder: string, destFolder?: string, options?: Waifu2xOptions, progress?: (current: number, total: number) => void | boolean) => {
        options = {...options}
        if (sourceFolder.endsWith("/")) sourceFolder = sourceFolder.slice(0, -1)
        const fileMap = Waifu2x.searchFiles(sourceFolder, options?.recursive)

        if (!options.limit) options.limit = fileMap.length
        let cancel = false
        let counter = 1
        let total = fileMap.length
        if (progress) progress(0, total)
        const sem = new AsyncSemaphore(options.parallelFrames || 1)
        const promises = fileMap.map(async (f) => {
            return sem.add(async () => {
                if(cancel) return null
                if(counter >= options.limit) cancel = true
                try {
                    const ret = await Waifu2x.upscaleImage(f, destFolder, options)
                    const stop = progress ? progress(counter++, total) : false
                    if (stop) cancel = true
                    return ret
                } catch (error) {
                    cancel = true
                    throw error
                }
            })
        })
        const results = await Promise.all(promises)
        return results.filter((r) => r !== null) as string[]
    }

    private static parseTransparentColor = (color: string) => {
        return Number(`0x${color.replace(/^#/, "")}`)
    }

    private static encodeGIF = async (files: string[], delays: number[], dest: string, quality?: number, transparentColor?: string) => {
        if (!quality) quality = 10
        return new Promise<void>((resolve) => {
            const dimensions = imageSize(files?.[0])
            const gif = new GifEncoder(dimensions.width, dimensions.height, {highWaterMark: 5 * 1024 * 1024})
            const file = fs.createWriteStream(dest)
            gif.pipe(file)
            gif.setQuality(quality)
            gif.setRepeat(0)
            gif.writeHeader()
            if (transparentColor) gif.setTransparent(Waifu2x.parseTransparentColor(transparentColor))
            let counter = 0
            //could turn this into a for loop
            const addToGif = (frames: string[]) => {
                getPixels(frames[counter], (err, pixels) => {
                    if(err) throw err
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
            gif.on("end", resolve)
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
        options = {...options}
        if (!dest) dest = "./"
        let frameExt = options.pngFrames ? "png" : "jpg" as any
        const frames = await gifFrames({url: source, frames: "all", outputType: frameExt})
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

        //todo refactor this
        async function downloadFrames(frames: any[]) {
            const promiseArray = []
            for (let i = 0; i < frames.length; i += step) {
                const writeStream = fs.createWriteStream(`${frameDest}/frame${i}.${frameExt}`)
                frames[i].getImage().pipe(writeStream)
                frameArray.push(`${frameDest}/frame${i}.${frameExt}`)
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
            frameArray = frameArray.slice(resume)
            const sem = new AsyncSemaphore(options.parallelFrames || 1)
            if (progress) progress(counter++, total)
            const promises = frameArray.map(async (f) => {
                return await sem.add(async () => {
                    if(cancel) return null
                    try {
                        const destPath = await Waifu2x.upscaleImage(f, `${upScaleDest}/${path.basename(f)}`, options)
                        const stop = progress ? progress(counter++, total) : false
                        if (stop) cancel = true
                        return destPath
                    } catch(error) {
                        cancel = true
                        throw error
                    }
                })
            })
            const results = (await Promise.all(promises)).filter((r) => r !== null)
            scaledFrames.push(...results)
        } else {
            scaledFrames = frameArray
        }
        scaledFrames = scaledFrames.sort(new Intl.Collator(undefined, {numeric: true, sensitivity: "base"}).compare)
        if (options.reverse) {
            scaledFrames = scaledFrames.reverse()
            delayArray = delayArray.reverse()
        }
        const finalDest = path.join(folder, image)
        await Waifu2x.encodeGIF(scaledFrames, delayArray, finalDest, options.quality, options.transparentColor)
        if (options.noResume || !cancel) Waifu2x.removeDirectory(frameDest)
        return path.normalize(finalDest).replace(/\\/g, "/")
    }

    public static upscaleGIFs = async (sourceFolder: string, destFolder?: string, options?: Waifu2xGIFOptions, totalProgress?: (current: number, total: number) => void | boolean, progress?: (current: number, total: number) => void | boolean) => {
        options = {...options}
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
                //todo should this error propagate?
                continue
            }
        }
        return retArray
    }

    private static dumpWebpFrames = async (source: string, frameDest?: string, webpPath?: string) => {
        const absolute = webpPath ? path.normalize(webpPath).replace(/\\/g, "/") : path.join(__dirname, "../webp")
        let program = `cd "${absolute}" && anim_dump.exe`
        if (process.platform === "darwin") program = `cd "${absolute}" && ./anim_dump.app`
        if (process.platform === "linux") program = `cd "${absolute}" && ./anim_dump`
        let command = `${program} -folder "${frameDest}" -prefix "frame" "${source}"`
        const child = child_process.exec(command)
        Waifu2x.addProcess(child)
        await new Promise<void>((resolve, reject) => {
            child.on("close", () => {
                Waifu2x.removeProcess(child)
                resolve()
            })
        })
        return fs.readdirSync(frameDest).sort(new Intl.Collator(undefined, {numeric: true, sensitivity: "base"}).compare)
        .filter((s) => s !== "settings.json")
    }

    private static parseWebpDelays = async (source: string, webpPath?: string) => {
        const absolute = webpPath ? path.normalize(webpPath).replace(/\\/g, "/") : path.join(__dirname, "../webp")
        let program = `cd "${absolute}" && webpmux.exe`
        if (process.platform === "darwin") program = `cd "${absolute}" && ./webpmux.app`
        if (process.platform === "linux") program = `cd "${absolute}" && ./webpmux`
        let command = `${program} -info "${source}"`
        const child = child_process.exec(command)
        let data = ""
        Waifu2x.addProcess(child)
        await new Promise<void>((resolve, reject) => {
            child.stdout.on("data", (chunk) => data += chunk)
            child.on("close", () => {
                Waifu2x.removeProcess(child)
                resolve()
            })
        })
        return data.split("\n").slice(5).map((r) => parseInt(r.split(/ +/g)[7])).filter(Boolean)
    }

    private static encodeAnimatedWebp = async (files: string[], delays: number[], dest: string, webpPath?: string, quality?: number) => {
        if (!quality) quality = 75
        const frames = files.map((f, i) => `-d ${delays[i]} "${f}"`).join(" ")
        const absolute = webpPath ? path.normalize(webpPath).replace(/\\/g, "/") : path.join(__dirname, "../webp")
        let program = `cd "${absolute}" && img2webp.exe`
        if (process.platform === "darwin") program = `cd "${absolute}" && ./img2webp.app`
        if (process.platform === "linux") program = `cd "${absolute}" && ./img2webp`
        let command = `${program} -loop "0" ${frames} -o "${dest}"`
        const child = child_process.exec(command)
        Waifu2x.addProcess(child)
        let error = ""
        //TODO handle errors?
        await new Promise<void>((resolve, reject) => {
            child.stderr.on("data", (chunk) => error += chunk)
            child.on("close", () => {
                Waifu2x.removeProcess(child)
                resolve()
            })
        })
        return dest
    }

    public static upscaleAnimatedWebp = async (source: string, dest?: string, options?: Waifu2xGIFOptions, progress?: (current: number, total: number) => void | boolean) => {
        options = {...options}
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
        let delays = await Waifu2x.parseWebpDelays(source, options.webpPath)
        const constraint = options.speed > 1 ? frames.length / options.speed : frames.length
        let step = Math.ceil(frames.length / constraint)
        let frameArray: string[] = []
        let delayArray: number[] = []
        for (let i = 0; i < frames.length; i += step) {
            frameArray.push(`${frameDest}/${frames[i]}`)
            delayArray.push(delays[i])
        }
        if (options.speed < 1) delayArray = delayArray.map((n) => n / options.speed)
        const upScaleDest = `${frameDest}/upscaled`
        if (!fs.existsSync(upScaleDest)) fs.mkdirSync(upScaleDest, {recursive: true})
        options.rename = ""
        let scaledFrames = fs.readdirSync(upScaleDest).map((f) => `${upScaleDest}/${path.basename(f)}`)
        let cancel = false
        if (options.scale !== 1) {
            let counter = resume
            let total = frameArray.length
            frameArray = frameArray.slice(resume)
            const sem = new AsyncSemaphore(options.parallelFrames || 1)
            if (progress) progress(counter++, total)
            const promises = frameArray.map(async (f) => {
                return await sem.add(async () => {
                    if(cancel) return null
                    try {
                        const destPath = await Waifu2x.upscaleImage(f, `${upScaleDest}/${path.basename(f)}`, options)
                        const stop = progress ? progress(counter++, total) : false
                        if (stop) cancel = true
                        return destPath
                    } catch(error) {
                        cancel = true
                        throw error
                    }
                })
            })
            const results = await Promise.all(promises)
            scaledFrames.push(...results.filter((r) => r !== null))
        } else {
            scaledFrames = frameArray
        }
        scaledFrames = scaledFrames.sort(new Intl.Collator(undefined, {numeric: true, sensitivity: "base"}).compare)
        if (options.reverse) {
            scaledFrames = scaledFrames.reverse()
            delayArray = delayArray.reverse()
        }
        const finalDest = path.join(folder, image)
        await Waifu2x.encodeAnimatedWebp(scaledFrames, delayArray, finalDest, options.webpPath, options.jpgWebpQuality)
        if (options.noResume || !cancel) Waifu2x.removeDirectory(frameDest)
        return path.normalize(finalDest).replace(/\\/g, "/")
    }

    public static upscaleAnimatedWebps = async (sourceFolder: string, destFolder?: string, options?: Waifu2xAnimatedWebpOptions, totalProgress?: (current: number, total: number) => void | boolean, progress?: (current: number, total: number) => void | boolean) => {
        options = {...options}
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

    public static upscaleVideo = async (source: string, dest?: string, options?: Waifu2xVideoOptions, progress?: (current: number, total: number) => void | boolean, interlopProgress?: (percent: number) => void | boolean) => {
        options = {...options}
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
        let frameExt = options.pngFrames ? "png" : "jpg" as any
        let framerate = ["-r", `${options.framerate}`]
        let crf = options.quality ? ["-crf", `${options.quality}`] : ["-crf", "16"]
        let codec = ["-vcodec", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart"]
        let colorFlags = ["-color_primaries", "bt709", "-colorspace", "bt709", "-color_trc", "bt709"]
        if (options.sdColorSpace) colorFlags = ["-color_primaries", "smpte170m", "-colorspace", "smpte170m", "-color_trc", "smpte170m"]
        let audio = `${frameDest}/audio.wav`
        if (resume === 0) {
            await new Promise<void>((resolve) => {
                ffmpeg(source).outputOptions([...framerate])
                .save(`${frameDest}/frame%d.${frameExt}`)
                .on("end", () => resolve())
            })
            await new Promise<void>((resolve, reject) => {
                ffmpeg(source).outputOptions("-bitexact").save(audio)
                .on("end", () => resolve())
                .on("error", () => reject())
            }).catch(() => audio = "")
        } else {
            if (!fs.existsSync(audio)) audio = ""
        }
        let upScaleDest = `${frameDest}/upscaled`
        if (!fs.existsSync(upScaleDest)) fs.mkdirSync(upScaleDest, {recursive: true})
        options.rename = ""
        let frameArray = fs.readdirSync(frameDest).map((f) => `${frameDest}/${f}`).filter((f) => path.extname(f) === `.${frameExt}`)
        frameArray = frameArray.sort(new Intl.Collator(undefined, {numeric: true, sensitivity: "base"}).compare)
        let scaledFrames = fs.readdirSync(upScaleDest).map((f) => `${upScaleDest}/${path.basename(f)}`)
        let cancel = false
        if (options.scale !== 1) {
            let counter = resume
            let total = frameArray.length
            frameArray = frameArray.slice(resume)
            const sem = new AsyncSemaphore(options.parallelFrames || 1)
            if (progress) progress(counter++, total)
            const promises = frameArray.map(async (f) => {
                return await sem.add(async () => {
                    if(cancel) return null
                    try {
                        const destPath = await Waifu2x.upscaleImage(f, `${upScaleDest}/${path.basename(f)}`, options)
                        const stop = progress ? progress(counter++, total) : false
                        if (stop) cancel = true
                        return destPath
                    } catch(error) {
                        cancel = true
                        throw error
                    }
                })
            })
            const results = (await Promise.all(promises)).filter((r) => r !== null)
            scaledFrames.push(...results)
        } else {
            scaledFrames = frameArray
            upScaleDest = frameDest
        }
        if (!options.fpsMultiplier) options.fpsMultiplier = 1
        if (options.fpsMultiplier !== 1) {
            let interlopDest = `${frameDest}/interlop`
            if (!fs.existsSync(interlopDest)) fs.mkdirSync(interlopDest, {recursive: true})
            const canceled = await rife.interpolateDirectory(upScaleDest, interlopDest, {multiplier: options.fpsMultiplier, ...options}, interlopProgress)
            if (!canceled) upScaleDest = interlopDest
        }
        let tempDest = `${upScaleDest}/temp.mp4`
        let finalDest = path.join(folder, image)
        let crop = "crop=trunc(iw/2)*2:trunc(ih/2)*2"
        if (!options.speed) options.speed = 1
        if (!options.reverse) options.reverse = false
        let targetFramerate = ["-framerate", `${options.framerate * options.fpsMultiplier}`]
        if (audio) {
            let filter: string[] = ["-vf", `${crop}`]
            await new Promise<void>((resolve) => {
                ffmpeg(`${upScaleDest}/frame%d.${frameExt}`).input(audio).outputOptions([...targetFramerate, ...codec, ...crf, ...colorFlags, ...filter])
                .save(`${upScaleDest}/${image}`)
                .on("end", () => resolve())
            })
            if (options.speed === 1 && !options.reverse) {
                tempDest = `${upScaleDest}/${image}`
            } else {
                let audioSpeed = options.pitch ? `asetrate=44100*${options.speed},aresample=44100` : `atempo=${options.speed}`
                filter = ["-filter_complex", `[0:v]setpts=${1.0/options.speed}*PTS${options.reverse ? ",reverse": ""}[v];[0:a]${audioSpeed}${options.reverse ? ",areverse" : ""}[a]`, "-map", "[v]", "-map", "[a]"]
                await new Promise<void>((resolve) => {
                    ffmpeg(`${upScaleDest}/${image}`).outputOptions([...targetFramerate, ...codec, ...crf, ...colorFlags, ...filter])
                    .save(tempDest)
                    .on("end", () => resolve())
                })
            }
        } else {
            let filter = ["-filter_complex", `[0:v]${crop},setpts=${1.0/options.speed}*PTS${options.reverse ? ",reverse": ""}[v]`, "-map", "[v]"]
            await new Promise<void>((resolve) => {
                ffmpeg(`${upScaleDest}/frame%d.${frameExt}`).outputOptions([...targetFramerate, ...codec, ...crf, ...colorFlags, ...filter])
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
            ffmpeg(tempDest).outputOptions([...targetFramerate, ...codec, ...crf, ...colorFlags, ...filter])
            .save(finalDest)
            .on("end", () => resolve())
            .on("error", (e) => {
                error = e
                resolve()
            })
        })
        if (error) return Promise.reject(error)
        if (options.noResume || !cancel) Waifu2x.removeDirectory(frameDest)
        return path.normalize(finalDest).replace(/\\/g, "/")
    }

    public static upscaleVideos = async (sourceFolder: string, destFolder?: string, options?: Waifu2xVideoOptions, totalProgress?: (current: number, total: number) => void | boolean, progress?: (current: number, total: number) => void | boolean) => {
        options = {...options}
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

type AsyncCallback<T> = () => Promise<T>
class AsyncSemaphore {
    private queue: AsyncCallback<any>[] = []
    private capacity: number
    private running: number = 0

    public constructor(capacity: number) {
        this.capacity = capacity
    }

    public add = <T>(callback: AsyncCallback<T>): Promise<T> => {
        return new Promise((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    const result = await callback()
                    resolve(result)
                } catch (error) {
                    reject(error)
                } finally {
                    this.running--
                    this.next()
                }
            });
            this.next()
        })
    }

    public next = async () => {
        if (this.running < this.capacity && this.queue.length > 0) {
            const callback = this.queue.shift()
            if (callback) {
                this.running++
                callback()
            }
        }
    }

    public setCapacity = (capacity: number) => {
        this.capacity = capacity
    }

    public clear = () => {
        this.queue = []
        this.running = 0
    }
}

module.exports.default = Waifu2x
