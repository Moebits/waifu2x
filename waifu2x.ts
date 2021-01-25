import * as util from "util"
import * as fs from "fs"
import {imageSize} from "image-size"
import * as ffmpeg from "fluent-ffmpeg"
import * as path from "path"
import * as stream from "stream"

const exec = util.promisify(require("child_process").exec)

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
    modelDir?: string
    recursion?: 0 | 1
    recursionFormat?: Waifu2xFormats
    rename?: string
    callFromPath?: boolean
}

export interface Waifu2xGIFOptions extends Waifu2xOptions {
    quality?: number
    speed?: number
    reverse?: boolean
    limit?: number
}

export interface Waifu2xVideoOptions extends Waifu2xOptions {
    framerate?: number
    quality?: number
    speed?: number
    reverse?: boolean
    limit?: number
    ffmpegPath?: string
    ffprobePath?: string
}

export default class Waifu2x {
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
                const newName = pathSplit[0].split("_")[0] + rename
                const newPath = `${folder}/${newName}.${pathSplit.pop()}`
                fs.renameSync(fullPath, newPath)
            }
        }
    }

    public static processorList = async (options?: {callFromPath?: boolean}) => {
        if (!options) options = {}
        const absolute = path.join(__dirname, "../waifu2x")
        let program = `cd ${absolute}/ && waifu2x-converter-cpp.exe`
        if (options.callFromPath) program = "waifu2x-converter-cpp"
        let command = `${program} -l`
        const {stdout} = await exec(command)
        return stdout.split("\n").map((s: string) => s.trim()).join("\n") as string
    }

    public static upscaleImage = async (source: string, dest: string, options?: Waifu2xOptions) => {
        if (!options) options = {}
        if (options.rename === undefined) options.rename = "2x"
        let sourcePath = source
        let destPath = dest
        let local = __dirname.includes("node_modules") ? path.join(__dirname, "../../../") : path.join(__dirname, "..")
        if (!path.isAbsolute(source) && !path.isAbsolute(dest)) {
            const {folder, image} = Waifu2x.parseFilename(source, dest, options.rename)
            if (!fs.existsSync(folder)) fs.mkdirSync(folder, {recursive: true})
            sourcePath = path.join(local, source)
            destPath = path.join(local, folder, image)
        }
        const absolute = path.join(__dirname, "../waifu2x")
        let program = `cd ${absolute}/ && waifu2x-converter-cpp.exe`
        if (options.callFromPath) program = "waifu2x-converter-cpp"
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
        const {stdout} = await exec(command)
        return stdout as string
    }

    public static upscaleImages = async (sourceFolder: string, destFolder: string, options?: Waifu2xOptions) => {
        if (!options) options = {}
        if (options.rename === undefined) options.rename = "2x"
        if (!options.recursion) options.recursion = 1
        if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, {recursive: true})
        let sourcePath = sourceFolder
        let destPath = destFolder
        let local = __dirname.includes("node_modules") ? path.join(__dirname, "../../../") : path.join(__dirname, "..")
        if (!path.isAbsolute(sourceFolder) && !path.isAbsolute(destFolder)) {
            sourcePath = path.join(local, sourceFolder)
            destPath = path.join(local, destFolder)
        }
        const absolute = path.join(__dirname, "../waifu2x")
        let program = `cd ${absolute} && waifu2x-converter-cpp.exe`
        if (options.callFromPath) program = "waifu2x-converter-cpp"
        let command = `${program} -i "${sourcePath}" -o "${destPath}" -r ${options.recursion} -s`
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
        if (options.recursionFormat) command += ` -f ${options.recursionFormat.toUpperCase()}`
        if (options.modelDir) {
            if (options.modelDir.endsWith("/")) options.modelDir = options.modelDir.slice(0, -1)
            if (!path.isAbsolute(options.modelDir)) options.modelDir = path.join(local, options.modelDir)
            command += ` --model-dir "${options.modelDir}"`
        }
        const {stdout} = await exec(command)
        const files = fs.readdirSync(destFolder)
        Waifu2x.recursiveRename(destFolder, files, options.rename)
        return stdout as string
    }

    private static encodeGIF = async (files: string[], delays: number[], dest: string, quality?: number) => {
        const GifEncoder = require("gif-encoder")
        const getPixels = require("get-pixels")
        if (!quality) quality = 10
        return new Promise<void>((resolve) => {
            const dimensions = imageSize(files[0])
            const gif = new GifEncoder(dimensions.width, dimensions.height)
            const file = fs.createWriteStream(dest)
            gif.pipe(file)
            gif.setQuality(quality)
            gif.setRepeat(0)
            gif.writeHeader()
            let counter = 0

            const addToGif = (frames: string[]) => {
                getPixels(frames[counter], function(err: Error, pixels: any) {
                    gif.setDelay(10 * delays[counter])
                    gif.addFrame(pixels.data)
                    gif.read()
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

    private static awaitStream = async (writeStream: stream.Writable) => {
        return new Promise((resolve, reject) => {
            writeStream.on("finish", resolve)
            writeStream.on("error", reject)
        })
    }

    public static upscaleGIF = async (source: string, dest: string, options?: Waifu2xGIFOptions, progress?: (current?: number, total?: number) => void | boolean) => {
        if (!options) options = {}
        const gifFrames = require("gif-frames")
        const frames = await gifFrames({url: source, frames: "all", cumulative: true})
        let {folder, image} = Waifu2x.parseFilename(source, dest, "2x")
        if (path.isAbsolute(source) && path.isAbsolute(dest)) {
            folder = dest.slice(0, -5).includes(".") ? path.dirname(dest) : dest
            if (folder.endsWith("/")) folder = folder.slice(0, -1)
        } else {
            let local = __dirname.includes("node_modules") ? path.join(__dirname, "../../../") : path.join(__dirname, "..")
            folder = path.join(local, folder)
        }
        const frameDest = `${folder}/${path.basename(source, path.extname(source))}Frames`
        if (fs.existsSync(frameDest)) Waifu2x.removeDirectory(frameDest)
        fs.mkdirSync(frameDest, {recursive: true})
        const constraint = options.speed > 1 ? frames.length / options.speed : frames.length
        let step = Math.ceil(frames.length / constraint)
        const frameArray: string[] = []
        let delayArray: number[] = []
        async function downloadFrames(frames: any) {
            const promiseArray = []
            for (let i = 0; i < frames.length; i += step) {
                const writeStream = fs.createWriteStream(`${frameDest}/frame${i}.jpg`)
                frames[i].getImage().pipe(writeStream)
                frameArray.push(`${frameDest}/frame${i}.jpg`)
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
        let scaledFrames: string[] = []
        if (options.scale !== 1) {
            for (let i = 0; i < frameArray.length; i++) {
                await Waifu2x.upscaleImage(frameArray[i], `${upScaleDest}/${path.basename(frameArray[i])}`, options)
                scaledFrames.push(`${upScaleDest}/${path.basename(frameArray[i])}`)
                const stop = progress(i + 1, frameArray.length)
                if (stop) break
            }
        } else {
            scaledFrames = frameArray
        }
        if (options.reverse) {
            scaledFrames = scaledFrames.reverse()
            delayArray = delayArray.reverse()
        }
        await Waifu2x.encodeGIF(scaledFrames, delayArray, `${folder}/${image}`, options.quality)
        Waifu2x.removeDirectory(frameDest)
        return `${folder}/${image}`
    }

    public static upscaleGIFs = async (sourceFolder: string, destFolder: string, options?: Waifu2xGIFOptions, totalProgress?: (current?: number, total?: number) => void | boolean, progress?: (current?: number, total?: number) => void | boolean) => {
        if (!options) options = {}
        const files = fs.readdirSync(sourceFolder)
        if (sourceFolder.endsWith("/")) sourceFolder = sourceFolder.slice(0, -1)
        const fileMap = files.map((file) => `${sourceFolder}/${file}`)
        if (!options.limit) options.limit = fileMap.length
        const retArray: string[] = []
        for (let i = 0; i < options.limit; i++) {
            if (!fileMap[i]) break
            try {
                const ret = await Waifu2x.upscaleGIF(fileMap[i], destFolder, options, progress)
                const stop = totalProgress(i + 1, options.limit)
                retArray.push(ret)
                if (stop) break
            } catch (err) {
                continue
            }
        }
        return retArray
    }

    public static upscaleVideo = async (source: string, dest: string, options?: Waifu2xVideoOptions, progress?: (current?: number, total?: number) => void | boolean) => {
        if (!options) options = {}
        if (options.ffmpegPath) ffmpeg.setFfmpegPath(options.ffmpegPath)
        if (options.ffprobePath) ffmpeg.setFfprobePath(options.ffprobePath) 
        if (!options.framerate) {
            options.framerate = await new Promise<number>((resolve) => {
                ffmpeg.ffprobe(source, function(err: any, metadata: any) {
                    resolve(Number(metadata.streams[0].r_frame_rate.split("/").reduce((acc: string, curr: string) => Number(acc) / Number(curr))))
                })
            })
        }
        let {folder, image} = Waifu2x.parseFilename(source, dest, "2x")
        if (path.isAbsolute(source) && path.isAbsolute(dest)) {
            folder = dest.slice(0, -5).includes(".") ? path.dirname(dest) : dest
            if (folder.endsWith("/")) folder = folder.slice(0, -1)
        } else {
            let local = __dirname.includes("node_modules") ? path.join(__dirname, "../../../") : path.join(__dirname, "..")
            folder = path.join(local, folder)
            source = path.join(local, source)
        }
        const frameDest = `${folder}/${path.basename(source, path.extname(source))}Frames`
        if (fs.existsSync(frameDest)) Waifu2x.removeDirectory(frameDest)
        fs.mkdirSync(frameDest, {recursive: true})
        let framerate = ["-r", `${options.framerate}`]
        let crf = options.quality ? ["-crf", `${options.quality}`] : ["-crf", "16"]
        let codec = ["-vcodec", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart"]
        await new Promise<void>((resolve) => {
            ffmpeg(source).outputOptions([...framerate])
            .save(`${frameDest}/frame%d.png`)
            .on("end", () => resolve())
        })
        let audio = `${frameDest}/audio.mp3`
        await new Promise<void>((resolve, reject) => {
            ffmpeg(source).save(audio)
            .on("end", () => resolve())
            .on("error", () => reject())
        }).catch(() => null)
        let upScaleDest = `${frameDest}/upscaled`
        if (!fs.existsSync(upScaleDest)) fs.mkdirSync(upScaleDest, {recursive: true})
        options.rename = ""
        let frameArray = fs.readdirSync(frameDest).map((f) => `${frameDest}/${f}`).filter((f) => path.extname(f) === ".png").sort(new Intl.Collator(undefined, {numeric: true, sensitivity: "base"}).compare)
        let scaledFrames: string[] = []
        if (options.scale !== 1) {
            for (let i = 0; i < frameArray.length; i++) {
                await Waifu2x.upscaleImage(frameArray[i], `${upScaleDest}/${path.basename(frameArray[i])}`, options)
                scaledFrames.push(`${upScaleDest}/${path.basename(frameArray[i])}`)
                const stop = progress(i + 1, frameArray.length)
                if (stop) break
            }
        } else {
            scaledFrames = frameArray
            upScaleDest = frameDest
        }
        if (fs.existsSync(audio)) {
            let filter: string[] = []
            if (options.speed) {
                filter = ["-filter_complex", `[0:v]setpts=${1.0/options.speed}*PTS${options.reverse ? ",reverse": ""}[v];[0:a]atempo=${options.speed}${options.reverse ? ",areverse" : ""}[a]`, "-map", "[v]", "-map", "[a]"]
                await new Promise<void>((resolve) => {
                    ffmpeg(`${upScaleDest}/frame%d.png`).input(audio).outputOptions([...framerate, ...codec, ...crf])
                    .save(`${upScaleDest}/${image}`)
                    .on("end", () => resolve())
                })
                await new Promise<void>((resolve) => {
                    ffmpeg(`${upScaleDest}/${image}`).outputOptions([...framerate, ...codec, ...crf, ...filter])
                    .save(`${folder}/${image}`)
                    .on("end", () => resolve())
                })
            } else {
                if (options.reverse) filter = ["-vf", "reverse", "-af", "areverse"]
                await new Promise<void>((resolve) => {
                    ffmpeg(`${upScaleDest}/frame%d.png`).input(audio).outputOptions([...framerate, ...codec, ...crf, ...filter])
                    .save(`${folder}/${image}`)
                    .on("end", () => resolve())
                })
            }
        } else {
            let filter = options.speed ? ["-filter_complex", `[0:v]setpts=${1.0/options.speed}*PTS${options.reverse ? ",reverse": ""}[v]`, "-map", "[v]"] : []
            if (options.reverse && !filter[0]) filter = ["-vf", "reverse"]
            await new Promise<void>((resolve) => {
                ffmpeg(`${upScaleDest}/frame%d.png`).outputOptions([...framerate, ...codec, ...crf, ...filter])
                .save(`${folder}/${image}`)
                .on("end", () => resolve())
            })
        }
        Waifu2x.removeDirectory(frameDest)
        return `${folder}/${image}`
    }

    public static upscaleVideos = async (sourceFolder: string, destFolder: string, options?: Waifu2xVideoOptions, totalProgress?: (current?: number, total?: number) => void | boolean, progress?: (current?: number, total?: number) => void | boolean) => {
        if (!options) options = {}
        const files = fs.readdirSync(sourceFolder)
        if (sourceFolder.endsWith("/")) sourceFolder = sourceFolder.slice(0, -1)
        const fileMap = files.map((file) => `${sourceFolder}/${file}`)
        if (!options.limit) options.limit = fileMap.length
        const retArray: string[] = []
        for (let i = 0; i < options.limit; i++) {
            if (!fileMap[i]) break
            try {
                const ret = await Waifu2x.upscaleVideo(fileMap[i], destFolder, options, progress)
                const stop = totalProgress(i + 1, options.limit)
                retArray.push(ret)
                if (stop) break
            } catch (err) {
                continue
            }
        }
        return retArray
    }

    private static removeDirectory = (dir: string) => {
        if (dir === "/" || dir === "./") return
        if (fs.existsSync(dir)) {
            fs.readdirSync(dir).forEach(function(entry) {
                const entryPath = path.join(dir, entry)
                if (fs.lstatSync(entryPath).isDirectory()) {
                    Waifu2x.removeDirectory(entryPath)
                } else {
                    fs.unlinkSync(entryPath)
                }
            })
            try {
                fs.rmdirSync(dir)
            } catch (e) {
                console.log(e)
            }
        }
    }
}

module.exports.default = Waifu2x
