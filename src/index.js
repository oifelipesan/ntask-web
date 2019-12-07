import App from './app'

window.onload = () => {
  const main = document.querySelector('main')

  new App(main).init()
}
