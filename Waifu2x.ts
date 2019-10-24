import {execSync} from "child_process"
import * as fs from "fs"
import * as path from "path"

export type Waifu2xFormats = 
    | ".bmp"
    | ".dib"
    | ".exr"
    | ".hdr"
    | ".jpe" 
    | ".jpeg" 
    | ".jpg" 
    | ".pbm" 
    | ".pgm" 
    | ".pic" 
    | ".png" 
    | ".pnm" 
    | ".ppm" 
    | ".pxm" 
    | ".ras" 
    | ".sr" 
    | ".tif" 
    | ".tiff" 
    | ".webp" 

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

    public static upScaleImage = (source: string, dest?: string, options?: Waifu2XOptions) => {
        if (!options.rename) options.rename = "2x"
        let {folder, image} = Waifu2x.parseFilename(source, dest, options.rename)
        if (!fs.existsSync(folder)) fs.mkdirSync(folder, {recursive: true})
        const program = "cd waifu2x && waifu2x-converter-cpp.exe"
        let command = `${program} -i ../${source} -o ../${folder}/${image} -s`
        if (options.noise) command += ` --noise-level ${options.noise}`
        if (options.scale) command +=  ` --scale-ratio ${options.scale}`
        if (options.pngCompression) command += ` -c ${options.pngCompression}`
        if (options.jpgWebpQuality) command += ` -q ${options.jpgWebpQuality}`
        return execSync(command).toString()
    }

    public static upScaleImages = (sourceFolder: string, destFolder: string, options?: Waifu2XOptions) => {
        if (!options.rename) options.rename = "2x"
        if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, {recursive: true})
        const program = "cd waifu2x && waifu2x-converter-cpp.exe"
        if (!options.recursion) options.recursion = 1
        let command = `${program} -i ../${sourceFolder} -o ../${destFolder} -r ${options.recursion} -s`
        if (options.noise) command += ` --noise-level ${options.noise}`
        if (options.scale) command +=  ` --scale-ratio ${options.scale}`
        if (options.pngCompression) command += ` -c ${options.pngCompression}`
        if (options.jpgWebpQuality) command += ` -q ${options.jpgWebpQuality}`
        if (options.recursionFormat) command += ` -f ${options.recursionFormat}`
        const output = execSync(command).toString()
        const files = fs.readdirSync(destFolder)
        Waifu2x.recursiveRename(destFolder, files, options.rename)
        return output
    }
}

module.exports.default = Waifu2x