import Signin from './components/signin'
import Signup from './components/signup'

class App {
  constructor(body) {
    this.signin = new Signin(body)
    this.signup = new Signup(body)
  }

  init() {
    this.signin.render()
    this.addEventListener()
  }

  addEventListener() {
    this.signinEvents()
    this.signupEvents()
  }

  signinEvents() {
    this.signin.on('error', () => alert('Erro de autenticação'))
    this.signin.on('signin', token => {
      localStorage.setItem('token', `bearer ${token}`)
      alert('Você está autenticado!')
    })
    this.signin.on('signup', () => this.signup.render())
  }

  signupEvents() {
    this.signup.on('error', err => alert(`Erro no cadastro. ${err.error}`))
    this.signup.on('signup', user => {
      alert(`${user.name} você foi cadastrado com sucesso!`)
      this.signin.render()
    })
  }
}

export default App
