export default class Memoria{
    constructor(){
        this.contenido = []
    }

    agregarVariable(nombre, valor){
        if(this.hayVariable(nombre)){
            this.actualiarVariable(nombre, valor)
        }else{
        this.contenido.push(new Variable (nombre, valor))
        }
    }

    hayVariable(nombre){
        return this.contenido.some(vari => vari.esEsteNombre(nombre))
    }

    verValor(nombre){ 
        return this.buscarVariable(nombre).verValor()
    }

    actualiarVariable(nombre, valor){
        this.buscarVariable(nombre).reasignarValor(valor)
    }

    buscarVariable(nombre){
        return this.contenido.find(vari => vari.esEsteNombre(nombre))
    }

    mostrarMemoria(){
        return this.contenido.map(value => value.mostrarVariable())
    }


}


class Variable{
    constructor(nombre, valor){
        this.nombre = nombre
        this.valor = valor
    }

    verValor(){
        return this.valor
    }

    esEsteNombre(nombre){
        return this.nombre == nombre
    }

    reasignarValor(valor){
        this.valor = valor
    }
    mostrarVariable(){
        return this.nombre + ": " + this.valor
   }
}
