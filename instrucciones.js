class Instruccion {
   
    proximaInstruccion(){
        return this.valor
    }
    estaResuelto(){
        return this.resuelto
    }
}

export class Imprimir extends Instruccion{
    constructor(valor, lugarAEscribir){
        super()
        this.resuelto = false
        this.valor = valor
        this.escritura = lugarAEscribir
    }

    resolver(hilo){
        console.log(this)
        this.resuelto = true
        this.escritura.innerHTML += `<p>${this.valor}</p>`
    }

    resolverPuro(hilo){
        this.escritura.innerHTML += `<p>${this.valor}</p>`
    }
}

export class Lectura extends Instruccion{
    constructor(valor){
        super()
        this.resuelto = false
        this.valor = valor
    }

    resolver(hilo){
        console.log(this)
        this.resuelto = true
        hilo.resolverLectura(this.valor)
    }

    resolverPuro(hilo){
        return hilo.valorLocalDe(this.valor)
    }


}

export class Escritura extends Instruccion{
    constructor(nombre, valor){
        super()
        this.resuelto = false
        this.nombre = nombre
        this.valor = valor
    }

    resolver(hilo){
        console.log(this)
        if(!this.valor.estaResuelto()){
            this.valor.resolver(hilo)
        }else{
            this.resuelto = true
            hilo.resolverEscritura(this.nombre, this.valor)
        }
    }
    
}

export class Operacion extends Instruccion{
    
}

export class Asignacion extends Instruccion{
    constructor(valor, instruccion){
        super()
        this.valor = valor
        this.dato = instruccion
    }


    /*resolucion(memoria){
        const valor = this.dato.resolucion()
        this.hilo.informar("local" + this.valor + "=" + valor)
        this.hilo.decidirQuienSigue(this)
        this.hilo.informar(this.valor + "=" + valor)
        memoria.agregarVariable(this.valor,valor)
    }
    */

}

export class Sumar extends Instruccion{
    constructor(instruccion1 , instruccion2){
        super()
        this.resuelto = false
        this.instruccion1 = instruccion1
        this.instruccion2 = instruccion2
    }
    resolverPuro(hilo){
        return this.instruccion1.resolverPuro() + this.instruccion2.resolverPuro()
    }
    resolver(hilo){
        console.log(this)
        if(!this.instruccion1.estaResuelto()){
            this.instruccion1.resolver(hilo)
        }else if(!this.instruccion2.estaResuelto()){
            this.instruccion2.resolver(hilo)
        }else{
            this.resuelto = true
            hilo.resolverConSuma(this.instruccion1,this.instruccion2)
        }
    }
}

export class ValorFijo extends Instruccion{
    constructor(valor){
        super()
        this.resuelto = false
        this.valor = valor
        
    }

   resolver(hilo){
    console.log(this)
        this.resuelto = true
        hilo.resolverSegunValorFijo(this.valor)
        
    }
    resolverPuro(hilo){
        return eval(this.valor)
    }
}

