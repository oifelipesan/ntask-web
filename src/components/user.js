import Ntask from '../ntask'
import Template from '../templates/user'

class User extends Ntask {
  constructor(body) {
    super()
    this.body = body
  }

  render() {
    this.renderUserData()
  }

  addEventListener() {
    this.userCancelClick()
  }

  renderUserData() {
    const opts = {
      method: 'GET',
      url: `${this.URL}/users`,
      json: true,
      headers: {
        authorization: localStorage.getItem('token')
      }
    }

    this.request(opts, (err, res, data) => {
      if (err || res.status === 400) {
        this.imit('error', err)
      } else {
        this.body.innerHTML = Template.render(data)
        this.addEventListener()
      }
    })
  }

  userCancelClick() {
    const button = this.body.querySelector('[data-remove-accont]')

    button.addEventListener('click', event => {
      event.preventDefault()

      if (confirm('Tem certeza que deseja excluir sua conta?')) {
        const opts = {
          method: 'DELETE',
          url: `${this.URL}/users`,
          headers: {
            authorization: localStorage.getItem('token')
          }
        }

        this.request(opts, (err, res, data) => {
          if (err || res.status === 400 || res.status === 401) {
            this.emit('remove-error', err)
          } else {
            this.emit('remove-account')
          }
        })
      }
    })
  }
}

export default User
