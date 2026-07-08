let _timeout = null
let _interval = null
let _active = false

export function loadingbar(duration, label = "", callback) {
    cancelLoadingbar()

    const wrapper = _getOrCreateBar()
    const fill = wrapper.querySelector(".castbar-fill")
    const labelEl = wrapper.querySelector(".castbar-label")
    const timerEl = wrapper.querySelector(".castbar-timer")

    labelEl.textContent = label
    timerEl.textContent = duration.toFixed(1)

    fill.style.transition = "none"
    fill.style.width = "0%"
    wrapper.style.display = "flex"

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            fill.style.transition = `width ${duration}s linear`
            fill.style.width = "100%"
        })
    })

    let remaining = duration
    _interval = setInterval(() => {
        remaining -= 0.1
        timerEl.textContent = Math.max(0, remaining).toFixed(1)
    }, 100)

    _active = true
    _timeout = setTimeout(() => {
        clearInterval(_interval)
        wrapper.style.display = "none"
        _active = false
        if (callback) callback()
    }, duration * 1000)
}

export function cancelLoadingbar() {
    if (_timeout) clearTimeout(_timeout)
    if (_interval) clearInterval(_interval)
    _timeout = null
    _interval = null
    _active = false
    const wrapper = document.getElementById("castbar-wrapper")
    if (wrapper) wrapper.style.display = "none"
}

export function isLoadingbarActive() {
    return _active
}

function _getOrCreateBar() {
    let wrapper = document.getElementById("castbar-wrapper")
    if (wrapper) return wrapper

    wrapper = document.createElement("div")
    wrapper.id = "castbar-wrapper"
    wrapper.className = "castbar-wrapper"
    wrapper.innerHTML = `
        <div class="castbar-bg">
            <div class="castbar-fill"></div>
            <span class="castbar-label"></span>
            <span class="castbar-timer"></span>
        </div>
    `
    document.body.appendChild(wrapper)
    return wrapper
}
