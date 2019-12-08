import Signin from './components/signin'
import Signup from './components/signup'
import Tasks from './components/tasks'
import TaskForm from './components/taskForm'
import User from './components/user'
import Menu from './components/menu'

class App {
  constructor(body, footer) {
    this.signin = new Signin(body)
    this.signup = new Signup(body)
    this.tasks = new Tasks(body)
    this.taskForm = new TaskForm(body)
    this.user = new User(body)
    this.menu = new Menu(footer)
  }

  init() {
    this.signin.render()
    this.addEventListener()
  }

  addEventListener() {
    this.signinEvents()
    this.signupEvents()
    this.tasksEvents()
    this.taskFormEvents()
    this.userEvents()
    this.menuEvents()
  }

  signinEvents() {
    this.signin.on('error', err => alert(`Erro de autenticação. ${err.error}`))
    this.signin.on('signin', token => {
      localStorage.setItem('token', `bearer ${token}`)
      this.menu.render('tasks')
      this.tasks.render()
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

  tasksEvents() {
    this.tasks.on('error', () => alert('Erro ao listar tarefas'))
    this.tasks.on('remove-error', () => alert('Erro o excluir tarefa'))
    this.tasks.on('update-error', () => alert('Erro ao atualizar tarefa'))
    this.tasks.on('remove', () => this.tasks.render())
    this.tasks.on('updated', () => this.tasks.render())
  }

  taskFormEvents() {
    this.taskForm.on('error', () => alert('Erro ao cadastrar tarefa'))
    this.taskForm.on('submit', () => {
      this.menu.render('tasks')
      this.tasks.render()
    })
  }

  userEvents() {
    this.user.on('error', () => alert('Erro ao carregar usuário!'))
    this.user.on('remove-error', () => alert('Erro ao excluir conta'))
    this.user.on('remove-account', () => {
      alert('Que pena! Sua conta foi excluida.')
      localStorage.clear()
      this.menu.clear()
      this.signin.render()
    })
  }

  menuEvents() {
    this.menu.on('click', path => {
      this.menu.render(path)
      this[path].render()
    })
    this.menu.on('logout', () => {
      localStorage.clear()
      this.menu.clear()
      this.signin.render()
    })
  }
}

export default App
