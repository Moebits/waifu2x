import {execSync} from "child_process"
import * as fs from "fs"
import {imageSize} from "image-size"
import * as path from "path"
import * as stream from "stream"

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
}

export default class Waifu2x {
    private static readonly isWin = process.platform === "win32" ? true : false
    public static parseFilename = (source: string, dest: string, rename: string) => {
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

    public static upscaleImage = (source: string, dest?: string, options?: Waifu2XOptions) => {
        if (!options) options = {}
        if (!options.rename) options.rename = "2x"
        const {folder, image} = Waifu2x.parseFilename(source, dest, options.rename)
        if (!fs.existsSync(folder)) fs.mkdirSync(folder, {recursive: true})
        const absolute = path.join(__dirname, "..", "waifu2x")
        let local: string
        if (__dirname.includes("node_modules")) {
            local = path.join(__dirname, "../../../")
        } else {
            local = path.join(__dirname, "..")
        }
        const sourcePath = path.join(local, source)
        const destPath = path.join(local, folder, image)
        const program = Waifu2x.isWin ? `cd ${absolute}/ && waifu2x-converter-cpp.exe` : `waifu2x-converter-cpp`
        let command = `${program} -i "${sourcePath}" -o "${destPath}" -s`
        if (options.noise) command += ` --noise-level ${options.noise}`
        if (options.scale) command +=  ` --scale-ratio ${options.scale}`
        if (options.pngCompression) command += ` -c ${options.pngCompression}`
        if (options.jpgWebpQuality) command += ` -q ${options.jpgWebpQuality}`
        return execSync(command).toString()
    }

    public static upscaleImages = (sourceFolder: string, destFolder: string, options?: Waifu2XOptions) => {
        if (!options) options = {}
        if (!options.rename) options.rename = "2x"
        if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, {recursive: true})
        if (!options.recursion) options.recursion = 1
        const absolute = path.join(__dirname, "..", "waifu2x")
        let local: string
        if (__dirname.includes("node_modules")) {
            local = path.join(__dirname, "../../../")
        } else {
            local = path.join(__dirname, "..")
        }
        const sourcePath = path.join(local, sourceFolder)
        const destPath = path.join(local, destFolder)
        const program = `cd ${absolute} && waifu2x-converter-cpp.exe`
        let command = `${program} -i "${sourcePath}" -o "${destPath}" -r ${options.recursion} -s`
        if (options.noise) command += ` --noise-level ${options.noise}`
        if (options.scale) command +=  ` --scale-ratio ${options.scale}`
        if (options.pngCompression) command += ` -c ${options.pngCompression}`
        if (options.jpgWebpQuality) command += ` -q ${options.jpgWebpQuality}`
        if (options.recursionFormat) command += ` -f ${options.recursionFormat.toUpperCase()}`
        const output = execSync(command).toString()
        const files = fs.readdirSync(destFolder)
        Waifu2x.recursiveRename(destFolder, files, options.rename)
        return output
    }

    public static encodeGif = async (files: string[], dest?: string) => {
        const GifEncoder = require("gif-encoder")
        const getPixels = require("get-pixels")
        return new Promise((resolve) => {
            const dimensions = imageSize(files[0])
            const gif = new GifEncoder(dimensions.width, dimensions.height)
            const pathIndex = files[0].search(/\d{8,}/)
            const pathDir = files[0].slice(0, pathIndex)
            if (!dest) dest = `${pathDir}${files[0].match(/(?<=\/)(\d{8,})(?=\/)/)[0]}.gif`
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

    public static awaitStream = async (writeStream: stream.Writable) => {
        return new Promise((resolve, reject) => {
            writeStream.on("finish", resolve)
            writeStream.on("error", reject)
        })
    }

    public static upscaleGIF = async (source: string, dest: string, constraint?: number) => {
        const gifFrames = require("gif-frames")
        const frames = await gifFrames({url: source, frames: "all"})
        const {folder, image} = Waifu2x.parseFilename(source, dest, "2x")
        const frameDest = `${folder}/${path.basename(source.slice(0, -4))}Frames`
        if (!fs.existsSync(frameDest)) fs.mkdirSync(frameDest, {recursive: true})
        let step = 1
        if (constraint && (constraint !== Infinity)) step = Math.ceil(frames.length / constraint)
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
        Waifu2x.upscaleImages(frameDest, upScaleDest)
        const scaledFrames = fs.readdirSync(upScaleDest)
        const newFrameArray = scaledFrames.map((f) => `${upScaleDest}/${f}`)
        await Waifu2x.encodeGif(newFrameArray, `${folder}/${image}`)
    }

    public static upscaleGifs = async (sourceFolder: string, destFolder: string, constraint?: number, limit?: number) => {
        const files = fs.readdirSync(sourceFolder)
        if (sourceFolder.endsWith("/")) sourceFolder = sourceFolder.slice(0, -1)
        const fileMap = files.map((file) => `${sourceFolder}/${file}`)
        if (!limit) limit = fileMap.length
        for (let i = 0; i < limit; i++) {
            if (!fileMap[i]) return
            try {
                Waifu2x.upscaleGIF(fileMap[i], destFolder, constraint)
            } catch (err) {
                continue
            }
        }
        return
    }
}

module.exports.default = Waifu2x
