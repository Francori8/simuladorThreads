export class ListaCircular{
    constructor(lista){
        this.lista  = lista
        this.indice = 0
    }
    siguienteElemento(){
        
        return this.lista[this.indice]
    }
    pasarElemento(){
        this.indice = (this.indice + 1) % this.lista.length
    }
    reiniciarTodos(){
        this.lista.forEach(element => element.reiniciar());
    }
}