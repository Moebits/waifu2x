import waifu2x from "./waifu2x"
import path from "path"

const start = async () => {
    const result2 = await waifu2x.upscaleImage("./images/img.png", "./images/upscale/img2x.png", {scale: 4, upscaler: "/Volumes/Files/Applications/Waifu2x GUI.app/Contents/models/AnimeSharp.pth"})
    console.log(result2)
}
start()