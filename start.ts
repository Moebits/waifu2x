import waifu2x from "./waifu2x"

(async () => {
    const progress = (current: number, total: number) => {
        console.log(`Current: ${current} Total: ${total}`)
    }
    const result = await waifu2x.upscaleVideo("./images/videos/onepiece.mp4", "./images/upscale", {scale: 1}, progress)
    console.log(result)
})()
