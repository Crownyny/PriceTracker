// Estado de la extensión
let isExtensionActive = false;

// Elementos del DOM
const toggleCheckbox = document.getElementById('toggleExtension');
const statusText = document.getElementById('status');
const openDashboardButton = document.getElementById('openDashboard');

// Cargar el estado guardado cuando se abre el popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadExtensionState();
});

// Cargar estado desde chrome.storage
async function loadExtensionState() {
  try {
    const result = await chrome.storage.local.get(['extensionActive']);
    isExtensionActive = result.extensionActive ?? false;
    updateUI();
  } catch (error) {
    console.error('Error loading extension state:', error);
  }
}

// Guardar estado en chrome.storage
async function saveExtensionState(active) {
  try {
    await chrome.storage.local.set({ extensionActive: active });
    isExtensionActive = active;
    updateUI();
  } catch (error) {
    console.error('Error saving extension state:', error);
  }
}

// Actualizar la UI basado en el estado
function updateUI() {
  toggleCheckbox.checked = isExtensionActive;
  
  if (isExtensionActive) {
    statusText.textContent = 'Activado';
    statusText.classList.remove('inactive');
    statusText.classList.add('active');
  } else {
    statusText.textContent = 'Desactivado';
    statusText.classList.remove('active');
    statusText.classList.add('inactive');
  }
}

// Event listener para el toggle
toggleCheckbox.addEventListener('change', (event) => {
  const isActive = event.target.checked;
  saveExtensionState(isActive);
});

// Event listener para abrir el dashboard
openDashboardButton.addEventListener('click', () => {
  // Abrir el dashboard en una nueva pestaña
  chrome.tabs.create({ 
    url: chrome.runtime.getURL('dashboard.html')
  });
});
