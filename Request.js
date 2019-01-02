const Dia = require ('./Dia.js')
const url  = require ('url')

module.exports = class Request {

    constructor (o) {
        this.uuid = Dia.new_uuid ()
        for (i in o) this [i] = o [i]
        this.run ()
    }

    async run () {
        await this.read_params ()
        this.process_params ()
    }

    get_module_name () {
        return this.q.type
    }

    get_method_name () {
        return 'get'
    }
    
    get_module () {
        return Dia.require_fresh (this.module_name)        
    }
    
    get_method () {
        let module = this.get_module ()
        if (!module) throw `Module not defined: ${this.module_name}`
        var method = module [this.method_name]
        if (!method) throw `Method not defined: ${this.module_name}.${this.method_name}`
        return method
    }

    async process_params () {
        this.module_name = this.get_module_name ()
        this.method_name = this.get_method_name ()
    }

    async read_params () {
        this.q = {}
        if (this.http_request) return await this.read_http_params ()
    }

    read_http_head_params () {
        let uri = url.parse (this.http_request.url)
        let params = new URLSearchParams (uri.search);
        for (var k of ['type', 'id', 'action', 'part']) if (params.has (k)) this.q [k] = params.get (k)
    }
    
    read_body_params () {
        let o = JSON.parse (this.body)
        for (let i in o) this.q [i] = o [i]
    }
    
    async read_http_params (rq) {
    
        this.body = await Dia.HTTP.get_http_request_body (this.http_request)
        this.read_body_params ()
        delete this.body
    
        this.read_http_head_params ()
           
    }
    
    out_json (code, data) {
        let rp = this.http_response
        rp.statusCode = code
        rp.setHeader ('Content-Type', 'application/json')
        rp.end (JSON.stringify (data))
    }

    out (data) {
        this.out_json (200, this.to_message (data))
    }
    
    carp (x) {
        console.log (this.uuid, x)
        this.out_json (500, this.to_fault (x))
    }
    
    to_message (data) {return {
        success: true, 
        content: data 
    }}

    to_fault (x) {return {
        success: false, 
        id: this.uuid, 
        dt: new Date ().toJSON ()
    }}
    
}