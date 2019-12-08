import TinyEmitter from 'tiny-emitter'
import Request from 'browser-request'
import Dotenv from 'dotenv'

Dotenv.config()

class Ntask extends TinyEmitter {
  constructor() {
    super()
    this.request = Request
    this.URL = 'https://fs-ntask-api.herokuapp.com/'
  }
}

export default Ntask
