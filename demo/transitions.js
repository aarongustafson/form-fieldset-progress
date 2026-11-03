const host = document.querySelector('#animated');
const toggle = document.querySelector('#enable-transitions');
const motion = matchMedia('(prefers-reduced-motion: no-preference)');
let active = null;
let updating = false;

if (typeof document.startViewTransition === 'function')
	toggle.closest('label').hidden = false;

function cancelTransition() {
	if (!active) return;
	// Skipping animation does not cancel its pending update callback.
	active.canceled = true;
	active.transition.skipTransition();
	active = null;
	delete document.documentElement.dataset.sectionTransition;
}

host.addEventListener('form-fieldset-progress:beforechange', (event) => {
	if (updating || event.defaultPrevented) return;
	if (active) {
		cancelTransition();
		return;
	}
	if (
		!toggle.checked ||
		!motion.matches ||
		typeof document.startViewTransition !== 'function'
	)
		return;
	event.preventDefault();
	const { stepIndex, previousIndex } = event.detail;
	const forward = stepIndex > previousIndex;
	const rtl = getComputedStyle(host).direction === 'rtl';
	document.documentElement.dataset.sectionTransition =
		forward !== rtl ? 'forward' : 'backward';
	const pending = { canceled: false, transition: null };
	pending.transition = document.startViewTransition(() => {
		if (pending.canceled || !host.isConnected || host.state !== 'ready')
			return;
		updating = true;
		try {
			host.goTo(stepIndex);
		} finally {
			updating = false;
		}
	});
	active = pending;
	const finish = () => {
		if (active !== pending) return;
		active = null;
		delete document.documentElement.dataset.sectionTransition;
	};
	pending.transition.ready.catch((error) => {
		if (error.name !== 'AbortError')
			console.error('Section animation unavailable:', error);
	});
	pending.transition.finished.then(finish, (error) => {
		finish();
		console.error('Section transition failed:', error);
	});
});

toggle.addEventListener('change', cancelTransition);
host.addEventListener('form-fieldset-progress:ready', cancelTransition);
host.querySelector('form').addEventListener('reset', cancelTransition);
host.querySelector('form').addEventListener('invalid', cancelTransition, true);
