export default [
  {
    id: 0,
    texto:
      "Thread(2){\n\tprint('rojo')\n}\n\n\nThread(2){\n\tprint('azul')\n}\n}",
    razon: "Ejemplo Impresion en pantalla",
  },
  {
    id: 1,
    texto:
      "global Int n = 0\n\nThread(1){\n\tn = n + 1\n}\n\n\nThread(1){\n\tprint(n)\n}\n}",
    razon: "Ejemplo de suma global e imprimit",
  },
  {
    id: 2,
    texto: "global Int n = 0\n\nThread(2){\n\tn = n + 1\n}\n}",
    razon: "Ejemplo de perdida de suma",
  },
  {
    id: 3,
    texto:
      "global Int x = 0\n\nglobal Int y = 0\n\nThread(1){\n\ty = x + 1\n}\n\nThread(1){\n\tx = y + 1\n}\n}",
    razon: "Ejemplo de perdida de suma con threads distintos",
  },
  {
    id: 4,
    texto:
      "global Int n = 1\n\nThread(2){\n\twhile( n == 1){\n\tn = n + 1\n\t}\n}",
    razon: "Ejemplo de un while",
  },

  {
    id: 5,
    texto:
      "global Int n = 0\n\nThread(1){\n\twhile( n < 2 ){\n\t\tprint(n)\n\t}\n}\n\nThread(1){\n\tn = n + 1\n\tn = n + 1\n}\n}",
    razon: "Ejemplo de while y suma sin resta",
  },
  {
    id: 6,
    texto:
      "global Int n = 0\n\nThread(2){\n\trepeat(3){\n\t\tn = n + 1\n\t}\n}",
    razon: "Ejemplo de repeat: 2 threads incrementan n 3 veces cada uno",
  },
  {
    id: 7,
    texto:
      "global Int n = 0\n\nThread(2){\n\tfor(local Int i = 0; i < 3; i = i + 1){\n\t\tn = n + 1\n\t}\n}",
    razon: "Ejemplo de for incremental: 2 threads suman n 3 veces cada uno",
  },
  {
    id: 8,
    texto:
      "global Int n = 0\n\nThread(1){\n\tfor(x : [1,2,3]){\n\t\tn = n + x\n\t}\n}",
    razon: "Ejemplo de for-each: suma los elementos de una lista",
  },
  {
    id: 9,
    texto:
      "global List ticket = [0,0]\nglobal List pidiendoTicket = [false,false]\nglobal Int n = 2\nglobal Int seccionCritica = 0\n\nThread(2){\n\tlocal Int id = getId()\n\tpidiendoTicket[id] = true\n\tticket[id] = 1 + ticket.maximum()\n\tpidiendoTicket[id] = false\n\tfor(local Int j=0;j<n;j=j+1){\n\t\twhile(pidiendoTicket[j]){\n\t\t}\n\t\twhile(ticket[j]!=0&&(ticket[j]<ticket[id]||(ticket[j]==ticket[id]&&j<id))){\n\t\t}\n\t}\n\tseccionCritica = seccionCritica + 1\n\tticket[id] = 0\n}",
    razon: "Algoritmo de Bakery (Lamport): exclusion mutua con 2 threads",
  },
];
