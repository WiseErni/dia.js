const assert = require ('assert')

module.exports = class {

	constructor (timer, options) {

		assert ( timer,              'timer not set')
		assert (!timer.is_paused (), 'the timer is already paused')
		
		this.created = new Date ()

		this.info = {
			is_paused: true,
			ts_paused: this.created.toJSON (),
		}
		
		let {error} = options; if (error != null) {
		
			this.error = error

			this.message = error.message || error
			
			this.info.error = this.message
		
		}
		else {

			this.message = options.message || 'pause'

		}

		this.scheduled = timer.clear (this.message)
		
		timer.current_pause = this

	}
	
	cancel (comment) {

		const {timer, scheduled} = this

		assert (timer.current_pause === this, 'timer.pause differs from this')
				
		timer.current_pause = null

		if (scheduled) timer.at (scheduled, comment)

		timer.notify ()

	}

	append_info (r) {
	
		for (const [k, v] of Object.entries (this.info)) r [k] = v
	
	}

}