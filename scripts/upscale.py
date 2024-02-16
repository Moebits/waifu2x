import sys
import subprocess
import pkg_resources

required = {"torch", "torchvision", "spandrel", "Pillow"}
installed = {pkg.key for pkg in pkg_resources.working_set}
missing = required - installed

if missing:
    python = sys.executable
    subprocess.check_call([python, "-m", "pip", "install", *missing], stdout=subprocess.DEVNULL)

import spandrel
import torch
import torchvision
from PIL import Image
import argparse

device = "mps" if torch.backends.mps.is_available() else "cuda" if torch.cuda.is_available() else "cpu"

def load_image(image, downscale):
    img = Image.open(image).convert("RGB")
    if downscale:
        img.thumbnail((int(downscale), int(downscale)))
    transform = torchvision.transforms.Compose([torchvision.transforms.ToTensor()])
    return transform(img).to(device)

def upscale(input_path, output_path, model_path, downscale):
    model = spandrel.ModelLoader().load_from_file(model_path).eval().to(device)
    image = load_image(input_path, downscale)
    image = image.unsqueeze(0)
    output = model(image)
    output = output.squeeze(0)
    torchvision.utils.save_image(output, output_path)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(prog="Upscaler")
    parser.add_argument("-i", "--input")
    parser.add_argument("-o", "--output")
    parser.add_argument("-m", "--model")
    parser.add_argument("-d", "--downscale")
    args = parser.parse_args()
    upscale(args.input, args.output, args.model, args.downscale)
