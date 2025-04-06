const sensorButtons = document.querySelectorAll(".sensor-button");
let selectedButton = sensorButtons.length > 0 ? sensorButtons[0] : null
if (selectedButton) {
    selectedButton.setAttribute("aria-selected", "true");
}

sensorButtons.forEach(button => {
    button.addEventListener("click", () => {
        selectedButton.setAttribute("aria-selected", "false");
        selectedButton = button
        selectedButton.setAttribute("aria-selected", "true");
    })
});


const toggleModeBtn = document.getElementById("toggleModeBtn");

toggleModeBtn.addEventListener("click", () => {
    const htmlElement = document.documentElement;
    const currentMode = htmlElement.getAttribute("data-color-mode");
    const lightTheme = htmlElement.getAttribute("data-light-theme");
    const darkTheme = htmlElement.getAttribute("data-dark-theme");

    if (currentMode === "dark") {
        htmlElement.setAttribute("data-color-mode", "light");
        htmlElement.setAttribute("data-theme", lightTheme);
    } else {
        htmlElement.setAttribute("data-color-mode", "dark");
        htmlElement.setAttribute("data-theme", darkTheme);
    }
});