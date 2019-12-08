import Ntask from '../ntask'
import Template from '../templates/signin'

class Signin extends Ntask {
  constructor(body) {
    super()
    this.body = body
  }

  render() {
    this.body.innerHTML = Template.render()
    this.body.querySelector('[data-email]').focus
    this.addEventListener()
  }

  addEventListener() {
    this.formSubmit()
    this.signupClick()
  }

  formSubmit() {
    const form = this.body.querySelector('form')

    form.addEventListener('submit', event => {
      event.preventDefault()

      const email = event.target.querySelector('[data-email]')
      const password = event.target.querySelector('[data-password]')
      const opts = {
        method: 'POST',
        url: `${this.URL}/auth`,
        json: true,
        body: {
          email: email.value,
          password: password.value
        }
      }

      this.request(opts, (err, res, data) => {
        if (
          err ||
          res.status === 400 ||
          res.status === 401 ||
          res.status === 404
        ) {
          this.emit('error', res.body)
        } else {
          this.emit('signin', data.token)
        }
      })
    })
  }

  signupClick() {
    const signup = this.body.querySelector('[data-signup]')

    signup.addEventListener('click', event => {
      event.preventDefault()

      this.emit('signup')
    })
  }
}

export default Signin
