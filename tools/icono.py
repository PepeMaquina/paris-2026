import zlib, struct

FONDO = (250, 247, 242)
TINTA = (28, 26, 23)
ROJO  = (140, 47, 31)

def silueta(u, v):
    """u,v en 0..1 dentro del recuadro de la torre. Devuelve True si es torre."""
    if v < 0.10:                                   # mastil
        return abs(u - .5) < .012
    if v < 0.16:                                   # remate
        return abs(u - .5) < .03
    t = (v - .16) / .84
    w = .035 + .45 * t ** 2.3                      # perfil que se abre hacia abajo
    dx = abs(u - .5)
    if dx > w:
        return False
    plataformas = (.30 < t < .345) or (.63 < t < .675)
    if plataformas:
        return dx < w + .05
    if t > .68:                                    # arco entre las patas
        hueco = w - .085
        arco = ((t - .68) / .32) ** .55 * .42
        if dx < min(hueco, arco):
            return False
    elif t > .35:
        if dx < (w - .10):
            return False
    return True

def png(ruta, lado):
    m = lado * 0.16
    filas = []
    for y in range(lado):
        fila = bytearray([0])
        for x in range(lado):
            u = (x - m) / (lado - 2 * m)
            v = (y - m) / (lado - 2 * m)
            c = FONDO
            r = ((x - lado / 2) ** 2 + (y - lado / 2) ** 2) ** .5
            if r > lado * .49:
                c = FONDO
            elif 0 <= u <= 1 and 0 <= v <= 1 and silueta(u, v):
                c = TINTA
            elif r > lado * .445:
                c = ROJO
            fila += bytes(c)
        filas.append(bytes(fila))
    cruda = b"".join(filas)

    def trozo(tipo, datos):
        c = tipo + datos
        return struct.pack(">I", len(datos)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)

    with open(ruta, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(trozo(b"IHDR", struct.pack(">IIBBBBB", lado, lado, 8, 2, 0, 0, 0)))
        f.write(trozo(b"IDAT", zlib.compress(cruda, 9)))
        f.write(trozo(b"IEND", b""))

def vista():
    for y in range(34):
        print("".join("#" if silueta((x + .5) / 26, (y + .5) / 34) else "." for x in range(26)))

if __name__ == "__main__":
    vista()
    png("icons/icono-180.png", 180)
    png("icons/icono-512.png", 512)
    print("iconos escritos")
