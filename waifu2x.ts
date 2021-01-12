import * as util from "util"
import * as fs from "fs"
import {imageSize} from "image-size"
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

export interface Waifu2XOptions {
    noise?: 0 | 1 | 2 | 3
    scale?: number
    pngCompression?: number
    jpgWebpQuality?: number
    recursion?: 0 | 1
    recursionFormat?: Waifu2xFormats
    rename?: string
    callFromPath?: boolean
    absolutePath?: boolean
}

export interface Waifu2XGIFOptions {
    constraint?: number
    limit?: number
    absolutePath?: boolean
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
            if (source.slice(-3).startsWith(".")) {
                image = `${path.basename(source).slice(0, -3)}${rename}${source.slice(-3)}`
            } else if (source.slice(-4).startsWith(".")) {
                image = `${path.basename(source).slice(0, -4)}${rename}${source.slice(-4)}`
            } else {
                image = `${path.basename(source).slice(0, -5)}${rename}${source.slice(-5)}`
            }
        }
        return {folder, image}
    }

    public static recursiveRename = (folder: string, fileNames: string[], rename: string) => {
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

    public static upscaleImage = async (source: string, dest?: string, options?: Waifu2XOptions) => {
        if (!options) options = {}
        if (!options.rename) options.rename = "2x"
        let sourcePath = source
        let destPath = dest
        if (!options.absolutePath) {
            const {folder, image} = Waifu2x.parseFilename(source, dest, options.rename)
            if (!fs.existsSync(folder)) fs.mkdirSync(folder, {recursive: true})
            let local: string
            if (__dirname.includes("node_modules")) {
                local = path.join(__dirname, "../../../")
            } else {
                local = path.join(__dirname, "..")
            }
            sourcePath = path.join(local, source)
            destPath = path.join(local, folder, image)
        }
        const absolute = path.join(__dirname, "../waifu2x")
        let program = `cd ${absolute}/ && waifu2x-converter-cpp.exe`
        if (options.callFromPath) program = "waifu2x-converter-cpp"
        let command = `${program} -i "${sourcePath}" -o "${destPath}" -s`
        if (options.noise) command += ` --noise-level ${options.noise}`
        if (options.scale) command +=  ` --scale-ratio ${options.scale}`
        if (options.pngCompression) command += ` -c ${options.pngCompression}`
        if (options.jpgWebpQuality) command += ` -q ${options.jpgWebpQuality}`
        const {stdout} = await exec(command)
        return stdout
    }

    public static upscaleImages = async (sourceFolder: string, destFolder: string, options?: Waifu2XOptions) => {
        if (!options) options = {}
        if (!options.rename) options.rename = "2x"
        if (!options.recursion) options.recursion = 1
        if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, {recursive: true})
        let sourcePath = sourceFolder
        let destPath = destFolder
        if (!options.absolutePath) {
            let local: string
            if (__dirname.includes("node_modules")) {
                local = path.join(__dirname, "../../../")
            } else {
                local = path.join(__dirname, "..")
            }
            sourcePath = path.join(local, sourceFolder)
            destPath = path.join(local, destFolder)
        }
        const absolute = path.join(__dirname, "../waifu2x")
        let program = `cd ${absolute} && waifu2x-converter-cpp.exe`
        if (options.callFromPath) program = "waifu2x-converter-cpp"
        let command = `${program} -i "${sourcePath}" -o "${destPath}" -r ${options.recursion} -s`
        if (options.noise) command += ` --noise-level ${options.noise}`
        if (options.scale) command +=  ` --scale-ratio ${options.scale}`
        if (options.pngCompression) command += ` -c ${options.pngCompression}`
        if (options.jpgWebpQuality) command += ` -q ${options.jpgWebpQuality}`
        if (options.recursionFormat) command += ` -f ${options.recursionFormat.toUpperCase()}`
        const {stdout} = await exec(command)
        const files = fs.readdirSync(destFolder)
        Waifu2x.recursiveRename(destFolder, files, options.rename)
        return stdout
    }

    public static encodeGIF = async (files: string[], dest: string) => {
        const GifEncoder = require("gif-encoder")
        const getPixels = require("get-pixels")
        return new Promise<void>((resolve) => {
            const dimensions = imageSize(files[0])
            const gif = new GifEncoder(dimensions.width, dimensions.height)
            const file = fs.createWriteStream(dest)
            gif.pipe(file)
            gif.setQuality(20)
            gif.setDelay(0)
            gif.setRepeat(0)
            gif.writeHeader()
            let counter = 0

            const addToGif = (frames: string[]) => {
                getPixels(frames[counter], function(err: Error, pixels: any) {
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

    public static upscaleGIF = async (source: string, dest: string, options?: Waifu2XGIFOptions) => {
        if (!options) options = {}
        const gifFrames = require("gif-frames")
        const frames = await gifFrames({url: source, frames: "all"})
        let {folder, image} = Waifu2x.parseFilename(source, dest, "2x")
        if (options.absolutePath) {
            folder = dest
            if (folder.endsWith("/")) folder = folder.slice(0, -1)
        } else {
            let local: string
            if (__dirname.includes("node_modules")) {
                local = path.join(__dirname, "../../../")
            } else {
                local = path.join(__dirname, "..")
            }
            folder = path.join(local, folder)
        }
        const frameDest = `${folder}/${path.basename(source.slice(0, -4))}Frames`
        if (!fs.existsSync(frameDest)) fs.mkdirSync(frameDest, {recursive: true})
        let step = 1
        if (options.constraint && (options.constraint !== Infinity)) step = Math.ceil(frames.length / options.constraint)
        const frameArray: string[] = []
        async function downloadFrames(frames: any) {
            const promiseArray = []
            for (let i = 0; i < frames.length; i += step) {
                const writeStream = fs.createWriteStream(`${frameDest}/frame${i}.jpg`)
                frames[i].getImage().pipe(writeStream)
                frameArray.push(`${frameDest}/frame${i}.jpg`)
                promiseArray.push(Waifu2x.awaitStream(writeStream))
            }
            return Promise.all(promiseArray)
        }
        await downloadFrames(frames)
        const upScaleDest = `${frameDest}/upscaled`
        if (!fs.existsSync(upScaleDest)) fs.mkdirSync(upScaleDest, {recursive: true})
        await Waifu2x.upscaleImages(frameDest, upScaleDest, {absolutePath: true})
        const scaledFrames = fs.readdirSync(upScaleDest)
        const newFrameArray = scaledFrames.map((f) => `${upScaleDest}/${f}`)
        await Waifu2x.encodeGIF(newFrameArray, `${folder}/${image}`)
        Waifu2x.removeDirectory(upScaleDest)
        Waifu2x.removeDirectory(frameDest)
        return `${folder}/${image}`
    }

    public static upscaleGIFs = async (sourceFolder: string, destFolder: string, options?: Waifu2XGIFOptions) => {
        if (!options) options = {}
        const files = fs.readdirSync(sourceFolder)
        if (sourceFolder.endsWith("/")) sourceFolder = sourceFolder.slice(0, -1)
        const fileMap = files.map((file) => `${sourceFolder}/${file}`)
        if (!options.limit) options.limit = fileMap.length
        const retArray = []
        for (let i = 0; i < options.limit; i++) {
            if (!fileMap[i]) return
            try {
                const ret = await Waifu2x.upscaleGIF(fileMap[i], destFolder, options)
                retArray.push(ret)
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
                    this.removeDirectory(entryPath)
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
