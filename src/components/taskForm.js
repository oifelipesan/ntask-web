import Ntask from '../ntask'
import Template from '../templates/taskForm'

class TaskForm extends Ntask {
  constructor(body) {
    super()
    this.body = body
  }

  render() {
    this.body.innerHTML = Template.render()
    this.body.querySelector('[data-task]').focus()
    this.addEventListener()
  }

  addEventListener() {
    this.formSubmit()
  }

  formSubmit() {
    const form = this.body.querySelector('form')

    form.addEventListener('submit', event => {
      event.preventDefault()

      const task = event.target.querySelector('[data-task]')
      const opts = {
        method: 'POST',
        url: `${this.URL}/tasks/register`,
        json: true,
        headers: {
          authorization: localStorage.getItem('token')
        },
        body: {
          title: task.value
        }
      }

      this.request(opts, (err, res, data) => {
        if (err || res.status === 400) {
          this.emit('error')
        } else {
          this.emit('submit')
        }
      })
    })
  }
}

export default TaskForm
