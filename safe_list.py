colors = [
    "red",
    "orange",
    "amber",
    "yellow",
    "lime",
    "green",
    "emerald",
    "teal",
    "cyan",
    "sky",
    "blue",
    "indigo",
    "violet",
    "purple",
    "fuchsia",
    "pink",
    "rose",
    "slate",
    "gray",
    "zinc",
    "neutral",
    "stone",
]

shades = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"]

prefixes = ["bg", "text", "border", "ring", "outline"]


with open("tailwind-safelist.txt", "w") as f:
    for p in prefixes:
        for c in colors:
            for s in shades:
                f.write(f"{p}-{c}-{s}\n")
