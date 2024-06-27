const LogEvent      = require ('../Log/Events/Timer.js')

const MAX_INT = 2147483647

const ST_NEW        = 0
const ST_SCHEDULED  = 1
const ST_CANCELLING = 2
const ST_RUNNING    = 3
const ST_FINISHED   = 4

const STATUS_LABEL = [
	'ST_NEW',
	'ST_SCHEDULED',
	'ST_CANCELLING',
	'ST_RUNNING',
	'ST_FINISHED',
]

module.exports = class {

	constructor (timer, date, label) {

		this.status      = ST_NEW		

		if (!timer) throw new Error ('timer not set')
		if (!(date instanceof Date)) throw new Error ('date must be Date')
		if (!label || typeof label !== 'string') throw new Error ('Invalid label')
	
		this.timer       = timer
		this.date        = date
		this.label       = label
		
		this.log_event   = this.timer.log_start (label)
		
		this.schedule ()

	}
		
	///// Logging
	
	log_info (label) {

		this.timer.log_write (this.log_event.set ({
			label, 
			phase: 'progress'
		}))

	}
	
	///// Workflow

	set_status (s) {
	
		if (!Number.isInteger (s)) throw new Error ('Invalid status: ' + s)

		let status_label = STATUS_LABEL [s]; if (status_label == null) throw new Error ('Invalid status: ' + s)

		this.status = s
		
		let {timer} = this
		
		if (this.status === ST_SCHEDULED) {		
			timer.scheduled_event = this		
		}
		else if (timer.scheduled_event === this) {		
			timer.scheduled_event = null
			this.date        = null		
		}

		if (this.status === ST_RUNNING) {		
			timer.running_event = this		
		}
		else if (timer.running_event === this) {		
			timer.running_event = null
		}
		
//		this.log_info ('Switched to ' + status_label)

		timer.notify ()

	}

	finish (note) {

		if (note != null) this.log_info (note)

		this.set_status (ST_FINISHED)

		this.timer.log_finish (this.log_event)

	}
	
	schedule () {
	
		if (this.status !== ST_NEW) throw Error ('Wrong status:' + this.status)
	
		const schedule_comments = this.adjust ()

		const delta = this.date.getTime () - Date.now ()

		const lambda = () => {		
			this.timeout = null
			this.date    = null
			this.run ()
		}

		if (delta > MAX_INT) {
			this.date    = null
			this.finish ()
			throw new Error ('Sorry, delays as big as ' + delta + ' ms are not supported. The maximum is ' + MAX_INT + ' ms ~ 24.8 days')
		}
		
		let {timer} = this, {scheduled_event} = timer; if (scheduled_event) {
		
			let {date} = scheduled_event; if (date.getTime () <= this.date.getTime ()) {

				return this.finish ('Was already scheluled at ' + date.toJSON () + ', bailing out.')

			}
			else {

				this.log_info (`Conflicting event ${scheduled_event.log_event.uuid} detected: it was scheduled at ${date.toJSON ()}, current target is ${this.date.toJSON ()}, cancel it`)

				scheduled_event.cancel ()

			}

		}

		this.timeout = delta <= 0 ? setImmediate (lambda) : setTimeout (lambda, delta)

		this.set_status (ST_SCHEDULED)

		this.log_info ('scheduled at ' + this.date.toJSON () + ' (' + schedule_comments + ')')
			
	}

	cancel (note) {
	
		let {date} = this

		switch (this.status) {
			case ST_CANCELLING : return
			case ST_SCHEDULED  : break
			default            : throw Error ('Wrong status:' + this.status)
		}

		let message = 'cancel requested'; if (note) message += ': ' + note

		this.log_info (message)
		this.set_status (ST_CANCELLING)
		
		clearTimeout (this.timeout)
		this.timeout = null
		
		this.finish ()
		
		return date

	}

	async run () {

		const {timer} = this

		if (this.status !== ST_SCHEDULED) return timer.log_write (this.log_event.set ({
			label: 'Attempt to run () in status ' + STATUS_LABEL [this.status],
			level: 'warn',
			phase: 'progress',
		}))

		this.set_status (ST_RUNNING)

		try {

			await timer.executor.run (this.log_event)

		}
		finally {

			this.finish ()
			
			timer.finish ()

		}

	}

	adjust () {
	
		let notes = []; for (let i of this.timer.adjusters ()) {

			const note = i.adjust (this.date)
			
			if (note != null) notes.push (note)

		}
		
		switch (notes.length) {
			case  0: return 'as requested'
			case  1: return notes [0]
			default: return notes.join (', ')
		}
		
	}

}