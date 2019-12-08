import App from './app'

window.onload = () => {
  const main = document.querySelector('main')
  const footer = document.querySelector('footer')

  new App(main, footer).init()
}
