import Ntask from '../ntask'
import Template from '../templates/signup'

class Signup extends Ntask {
  constructor(body) {
    super()
    this.body = body
  }

  render() {
    this.body.innerHTML = Template.render()
    this.body.querySelector('[data-name]').focus()
    this.addEventListener()
  }

  addEventListener() {
    this.formSubmit()
  }

  formSubmit() {
    const form = this.body.querySelector('form')

    form.addEventListener('submit', event => {
      event.preventDefault()

      const name = event.target.querySelector('[data-name]')
      const email = event.target.querySelector('[data-email]')
      const password = event.target.querySelector('[data-password]')
      const opts = {
        method: 'POST',
        url: `${this.URL}/users/register`,
        json: true,
        body: {
          name: name.value,
          email: email.value,
          password: password.value
        }
      }

      this.request(opts, (err, res, data) => {
        if (err || res.status === 400) {
          this.emit('error', res.body)
        } else {
          this.emit('signup', data)
        }
      })
    })
  }
}

export default Signup
