import Ntask from '../ntask'
import Template from '../templates/footer'

class Menu extends Ntask {
  constructor(body) {
    super()
    this.body = body
  }

  render(path) {
    this.body.innerHTML = Template.render(path)
    this.addEventListener()
  }

  clear() {
    this.body.innerHTML = ''
  }

  addEventListener() {
    this.pathsClick()
    this.logoutClick()
  }

  pathsClick() {
    const links = this.body.querySelectorAll('[data-path]')

    for (let i = 0, max = links.length; i < max; i++) {
      links[i].addEventListener('click', event => {
        event.preventDefault()

        const link = event.target.parentElement
        const path = link.getAttribute('data-path')

        this.emit('click', path)
      })
    }
  }

  logoutClick() {
    const link = this.body.querySelector('[data-logout]')

    link.addEventListener('click', event => {
      event.preventDefault()

      this.emit('logout')
    })
  }
}

export default Menu
