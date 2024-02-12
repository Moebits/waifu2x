import waifu2x from "./waifu2x"
import path from "path"

const start = async () => {
    const result2 = await waifu2x.upscaleImage("/Users/chris/Documents/Moepi/Programming/Packages/waifu2x/images/img.png", 
    "/Users/chris/Documents/Moepi/Programming/Packages/waifu2x/images/upscale/img2x.png", {upscaler: "waifu2x"})
    console.log(result2)
}
start()