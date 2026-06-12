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

    // Devuelve una copia con los valores actuales de cada variable.
    // Los valores de referencia (canales, semáforos, instancias) se comparten —
    // igual que las variables globales: el hijo ve el mismo objeto, pero tiene su propio slot.
    clonar() {
        const copia = new Memoria();
        for (const v of this.contenido) {
            copia.contenido.push(new Variable(v.nombre, v.valor));
        }
        return copia;
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
