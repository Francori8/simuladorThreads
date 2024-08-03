export default [
    {
        id : 0,
        texto: 
        "Thread(2){\n\tprint('rojo')\n}\n\n\nThread(2){\n\tprint('azul')\n}\n}"
       ,
        razon:"Ejemplo Impresion en pantalla"
    },
    {
        id : 1,
        texto: 
        "global Int n = 0\n\nThread(1){\n\tn = n + 1\n}\n\n\nThread(1){\n\tprint(n)\n}\n}"
       ,
        razon:"Ejemplo de suma global e imprimit"
    },
    {
        id : 2,
        texto: 
        "global Int n = 0\n\nThread(2){\n\tn = n + 1\n}\n}"
       ,
        razon:"Ejemplo de perdida de suma"
    },
    {
        id : 3,
        texto: 
        "global Int x = 0\n\nglobal Int y = 0\n\nThread(1){\n\ty = x + 1\n}\n\nThread(1){\n\tx = y + 1\n}\n}"
       ,
        razon:"Ejemplo de perdida de suma con threads distintos"
    },
    {
        id : 4,
        texto: 
        "global Int n = 1\n\nThread(2){\n\twhile( n == 1){\n\tn = n + 1\n\t}\n}"
       ,
        razon:"Ejemplo de un while"
    },
] 
