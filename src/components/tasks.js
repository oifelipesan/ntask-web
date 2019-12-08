import Ntask from '../ntask'
import Template from '../templates/tasks'

class Tasks extends Ntask {
  constructor(body) {
    super()
    this.body = body
  }

  render() {
    this.renderTaskList()
  }

  addEventListener() {
    this.taskDoneCheckbox()
    this.taskRemoveClick()
  }

  renderTaskList() {
    const opts = {
      method: 'GET',
      url: `${this.URL}/tasks`,
      json: true,
      headers: {
        authorization: localStorage.getItem('token')
      }
    }

    this.request(opts, (err, res, data) => {
      if (err) {
        this.imit('error', err)
      } else {
        this.body.innerHTML = Template.render(data)
        this.addEventListener()
      }
    })
  }

  taskDoneCheckbox() {
    const dones = this.body.querySelectorAll('[data-done]')

    for (let i = 0, max = dones.length; i < max; i++) {
      dones[i].addEventListener('click', event => {
        event.preventDefault()

        const id = event.target.getAttribute('data-task-id')
        const done = event.target.getAttribute('data-task-done')
        const opts = {
          method: 'PUT',
          url: `${this.URL}/tasks/${id}`,
          headers: {
            authorization: localStorage.getItem('token'),
            'Content-type': 'application/json'
          },
          body: JSON.stringify({
            done: !done
          })
        }

        this.request(opts, (err, res, data) => {
          if (err || res.status === 400 || res.status === 404) {
            this.emit('uptade-error', err)
          } else {
            this.emit('updated')
          }
        })
      })
    }
  }

  taskRemoveClick() {
    const removes = this.body.querySelectorAll('[data-remove]')

    for (let i = 0, max = removes.length; i < max; i++) {
      removes[i].addEventListener('click', event => {
        event.preventDefault()

        if (confirm('Deseja excluir esta tarefa?')) {
          const id = event.target.getAttribute('data-task-id')
          const opts = {
            method: 'DELETE',
            url: `${this.URL}/tasks/${id}`,
            headers: {
              authorization: localStorage.getItem('token')
            }
          }

          this.request(opts, (err, res, data) => {
            if (err || res.status === 400 || res.status === 404) {
              this.imit('remove-error', err)
            } else {
              this.emit('remove')
            }
          })
        }
      })
    }
  }
}

export default Tasks
