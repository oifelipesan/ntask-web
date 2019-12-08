import TinyEmitter from 'tiny-emitter'
import Request from 'browser-request'
import Dotenv from 'dotenv'

Dotenv.config()

class Ntask extends TinyEmitter {
  constructor() {
    super()
    this.request = Request
    this.URL = process.env.BASE_URL
  }
}

export default Ntask
