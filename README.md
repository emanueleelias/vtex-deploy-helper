# VTEX Deploy Helper

---

[![npm version](https://badge.fury.io/js/vtex-deploy-helper.svg)](https://badge.fury.io/js/vtex-deploy-helper)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

**vtex-deploy-helper** es una librería de Node.js que proporciona una interfaz de línea de comandos (CLI) para facilitar el despliegue de aplicaciones en VTEX IO. Con este paquete, puedes automatizar y simplificar los procesos de despliegue, incluyendo la publicación de aplicaciones, la actualización de versiones y la migración de los ids de site editor si estas realizando una major.

---

### **Características Principales**

- **Automatización de Despliegues**: Ejecuta comandos de VTEX IO de manera secuencial y automatizada.
- **Soporte para Múltiples Tipos de Despliegue**:
  - **Patch Stable**: Despliegue de parches menores.
  - **Major Stable**: Despliegue de versiones mayores con migración de CMS.
  - **Despliegue de nueva custom app**: Despliegue de una nueva custom app.
  - **Actualización de custom app**: Actualización de una custom app existente.
- **Interfaz de Línea de Comandos (CLI)**: Interfaz amigable para guiar al usuario a través del proceso de despliegue.
- **Verificaciones Previas**: Asegura que el directorio de trabajo y la versión del manifest sean correctos antes de iniciar el despliegue, en caso de custom apps.
- **Feedback en Tiempo Real**: Proporciona mensajes de estado y errores durante el proceso de despliegue.

---

### **Instalación**

Para instalar `vtex-deploy-helper` globalmente en tu sistema, ejecuta el siguiente comando en tu terminal:

```bash
npm install -g vtex-deploy-helper
```

Esto te permitirá utilizar el comando `vdeploy` desde cualquier lugar en tu sistema.

---

### **Uso del Comando `vdeploy`**

El comando `vdeploy` es la interfaz principal para interactuar con la librería. Aquí te mostramos cómo usarlo:

```bash
vdeploy
```

Al ejecutar este comando, se te guiará a través de un proceso interactivo para seleccionar el tipo de despliegue y proporcionar la información necesaria.

#### **Opciones del Comando**

- **Tipo de Despliegue**: Selecciona el tipo de despliegue que deseas realizar:
  - **Release patch stable**: Para desplegar parches menores.
  - **Release major stable (con migración de CMS)**: Para desplegar versiones mayores incluyendo la migración de CMS.
  - **Deploy de custom app nueva**: Para desplegar una nueva custom app.
  - **Update de custom app**: Para actualizar una custom app existente.

#### **Ejemplo de Uso**

```bash
$ vdeploy
🚀 Iniciando proceso de deploy VTEX IO
? ¿Qué tipo de despliegue quieres realizar? Release patch stable
Configuración seleccionada:
• Tipo de deploy: PATCH_STABLE
🔍 Verificando custom app...
...
✅ Patch stable completado exitosamente
```

---

### **Configuración Adicional**

No se requiere configuración adicional para utilizar `vtex-deploy-helper`. Sin embargo, asegúrate de tener instalado y configurado correctamente el CLI de VTEX en tu sistema.

---

### **Contribución**

¡Si queres contribuir con `vtex-deploy-helper`! por favor seguí estos pasos:

1. **Fork** el repositorio.
2. **Crea una rama** para tu nueva funcionalidad (`git checkout -b feature/nueva-funcionalidad`).
3. **Commitea tus cambios** (`git commit -am 'Añadir nueva funcionalidad'`).
4. **Sube tus cambios** (`git push origin feature/nueva-funcionalidad`).
5. **Abre un Pull Request**.

---

### **Licencia**

Este proyecto está licenciado bajo la licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más detalles.

---

### **Contacto**

Si tienes alguna pregunta o sugerencia, no dudes en abrir un issue en el repositorio de GitHub o contactarme directamente.

- **GitHub**: [Repositorio de vtex-deploy-helper](https://github.com/emanueleelias/vtex-deploy-helper)
- **Correo Electrónico**: <emanueleeliasdaniel@gmail.com>

---

¡Gracias por utilizar `vtex-deploy-helper`! Espero que esta herramienta te ayude a simplificar tus procesos de despliegue en VTEX IO.
