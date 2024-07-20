class Instruccion{
   
    resolucion(memoria){
        new Error("La concreta tiene que implementarlo")
    }
}

export class Lectura extends Instruccion{
    constructor(valor){
        super()
        this.valor = valor
    }


}

export class Escritura extends Instruccion{
    constructor(nombre, valor){
        super()
        this.nombre = nombre
        this.valor = valor
    }
}

export class Aritmetica extends Instruccion{
    
}

export class Asignacion extends Instruccion{
    constructor(valor, instruccion){
        super()
        this.valor = valor
        this.dato = instruccion
    }


    /*resolucion(memoria){
        const valor = this.dato.resolucion()
        this.estado.informar("local" + this.valor + "=" + valor)
        this.estado.decidirQuienSigue(this)
        this.estado.informar(this.valor + "=" + valor)
        memoria.agregarVariable(this.valor,valor)
    }
    */

}

export class Sumar extends Instruccion{
    constructor(instruccion1 , instruccion2){
        super()
        this.instruccion1 = instruccion1
        this.instruccion2 = instruccion2
        
    }

   /* resolucion(memoria){
        this.estado.informar(this.instruccion1.resolucion() + "+" + this.instruccion2.resolucion())
        return this.instruccion1.resolucion() + this.instruccion2.resolucion() 
    }*/
}

export class ValorFijo extends Instruccion{
    constructor(valor){
        super()
        this.valor = valor
        
    }

   /* resolucion(memoria , estado){
        this.estado.informar(valor + "=" + memoria.verValor(this.valor))
        return  memoria.verValor(this.valor)
    }
        */
}
