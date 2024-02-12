import waifu2x from "./waifu2x"
import path from "path"

const start = async () => {
    const result2 = await waifu2x.upscaleImage("/Users/chris/Documents/Moepi/Programming/Packages/waifu2x/images/laffey2.jpg", 
    "/Users/chris/Documents/Moepi/Programming/Packages/waifu2x/images/upscale/laffey2x.jpg", {upscaler: "waifu2x"})
    console.log(result2)
}
start()