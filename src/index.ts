import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import ora from 'ora';
import * as inquirer from 'inquirer';
import { existsSync } from 'fs';
import path from 'path';
import * as fs from 'fs';


interface ManifestData {
  vendor: string;
  name: string;
  version: string;
}

const execAsync = promisify(exec);

async function execCommandAsync(command: string): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stderr) {
      console.log(chalk.yellow('Advertencia:'), stderr);
    }
    return stdout;
  } catch (error) {
    console.error(chalk.red(`Error ejecutando comando: ${command}`));
    throw error;
  }
}

function execCommand(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Separamos el comando y sus argumentos
    const [cmd, ...args] = command.split(' ');

    // Creamos el proceso con stdio heredado para permitir interacción
    const childProcess = spawn(cmd, args, {
      stdio: 'inherit', // Esto permite la interacción directa con el proceso
      shell: true
    });

    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });

    childProcess.on('error', (err) => {
      reject(err);
    });
  });
}

// Helper para hacer delay entre comandos si es necesario
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export type DeployType = 'PATCH_STABLE' | 'NEW_CUSTOM_APP' | 'UPDATE_CUSTOM_APP' | 'MAJOR_STABLE';

export interface DeployOptions {
  deployType?: DeployType;
}

export class VtexDeploy {
  private deployType: DeployType;
  private vendor: string = '';

  constructor(options: DeployOptions = {}) {
    this.deployType = options.deployType || 'PATCH_STABLE';
  }

  private async promptForVendor(): Promise<void> {
    const { vendor } = await inquirer.prompt([{
      type: 'input',
      name: 'vendor',
      message: '¿Cuál es el vendor?',
      validate: (input) => input.length > 0 || 'El vendor es requerido'
    }]);
    this.vendor = vendor;
  }


  private async getVendorFromManifest(): Promise<string> {
    try {
      // Obtener el directorio actual
      const currentDir = process.cwd();
      const manifestPath = path.join(currentDir, 'manifest.json');

      // Verificar si existe el archivo
      if (!fs.existsSync(manifestPath)) {
        throw new Error('No se encontró el archivo manifest.json en el directorio actual. Asegúrate de estar en el directorio raíz del proyecto.');
      }

      // Leer y parsear el manifest.json
      const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      const manifest: ManifestData = JSON.parse(manifestContent);

      // Validar que exista el vendor
      if (!manifest.vendor) {
        throw new Error('No se encontró el campo "vendor" en el manifest.json');
      }

      return manifest.vendor;
    } catch (error) {
      if (error instanceof Error) {
        console.error(chalk.red('\n❌ Error al leer el manifest.json:'), error.message);
      }
      throw error;
    }
  }

  private async checkCustomAppDirectory(): Promise<boolean> {
    const { isInDirectory } = await inquirer.prompt([{
      type: 'confirm',
      name: 'isInDirectory',
      message: '¿Estás dentro del directorio de la custom app?',
      default: false
    }]);

    if (!isInDirectory) {
      console.log(chalk.yellow('⚠️ Por favor, posiciónate dentro del directorio de la custom app y vuelve a ejecutar el script.'));
      return false;
    }

    // Verificar si existe el manifest.json
    if (!existsSync('./manifest.json')) {
      console.log(chalk.red('❌ No se encontró el archivo manifest.json. Asegúrate de estar en el directorio correcto.'));
      return false;
    }

    return true;
  }

  private async checkVersionUpdate(): Promise<boolean> {
    const { versionUpdated } = await inquirer.prompt([{
      type: 'confirm',
      name: 'versionUpdated',
      message: '¿Has actualizado la versión en el manifest.json y subido los cambios al repositorio?',
      default: false
    }]);

    if (!versionUpdated) {
      console.log(chalk.yellow('⚠️ Debes actualizar la versión en el manifest.json y subir los cambios antes de continuar.'));
      return false;
    }

    return true;
  }

  private async promptForMigrationContinuation(): Promise<boolean> {
    const { continueDeploy } = await inquirer.prompt([{
      type: 'confirm',
      name: 'continueDeploy',
      message: '¿Desea continuar con la promoción del workspace de production a master?',
      default: false
    }]);

    return continueDeploy;
  }

  private async executePatchStable(): Promise<void> {
    try {
      this.vendor = await this.getVendorFromManifest();
      console.log(chalk.green(`\n🔎 Vendor detectado desde manifest.json: ${this.vendor}`));
      const spinner = ora('Ejecutando patch stable...').start();

      try {
        // console.log(chalk.yellow(`\n👤 Ejecutando login para vendor: ${this.vendor}`));
        spinner.stop(); // Detenemos el spinner antes de cada comando interactivo

        console.log(chalk.yellow(`\n👤 Iniciando sesión en VTEX - (vtex login ${this.vendor})...`));
        await execCommand(`vtex login ${this.vendor}`);

        console.log(chalk.yellow('\n🧹 Eliminando/limpiando workspace de producción si existe - (vtex workspace delete production)...'));
        await execCommand('vtex workspace delete production');

        console.log(chalk.yellow('\n🔄 Cambiando a workspace production - (vtex use production --production)...'));
        await execCommand('vtex use production --production');

        console.log(chalk.yellow('\n📤 Ejecutando release patch stable - (vtex release patch stable)...'));
        await execCommand('vtex release patch stable');

        console.log(chalk.yellow('\n🛠️ Ejecutando deploy force - (vtex deploy --force)...'));
        await execCommand('vtex deploy --force');

        console.log(chalk.yellow('\n💾 Actualizando workspace de producción - (vtex update)...'));
        await execCommand('vtex update');

        // Mostramos el link de producción
        const productionUrl = `https://production--${this.vendor}.myvtex.com/`;
        console.log(chalk.cyan('\n🌐 Por favor, verifica los cambios en:'));
        console.log(chalk.blue(productionUrl));

        // Preguntamos al usuario si desea continuar
        const { continuar } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'continuar',
            message: '¿Los cambios están correctos y deseas continuar con el proceso?',
            default: false,
          },
        ]);

        if (!continuar) {
          console.log(chalk.yellow('\nProceso cancelado por el usuario'));
          return;
        }

        console.log(chalk.yellow('\n🔄 Cambiando a workspace master - (vtex use master)...'));
        await execCommand('vtex use master');

        console.log(chalk.yellow('\n💾 Actualizando workspace master - (vtex update)...'));
        await execCommand('vtex update');

        console.log(chalk.green('\n✅ Patch stable completado exitosamente 🚀'));
      } catch (error) {
        console.error(chalk.red('\n❌ Error durante el patch stable'));
        throw error;
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Error en patch stable:'), error);
      throw error;
    }
  }

  private async executeNewCustomApp(): Promise<void> {
    try {
      this.vendor = await this.getVendorFromManifest();
      console.log(chalk.green(`\n🔎 Vendor detectado desde manifest.json: ${this.vendor}`));

      // Verificación de directorio
      console.log(chalk.blue('\n🔍 Verificando custom app...'));
      if (!await this.checkCustomAppDirectory()) {
        throw new Error('Directorio incorrecto para custom app');
      }

      const spinner = ora('Iniciando deploy de nueva custom app...').start();

      try {
        spinner.stop();
        console.log(chalk.yellow(`\n👤 Iniciando sesión en VTEX - (vtex login ${this.vendor})...`));
        await execCommand(`vtex login ${this.vendor}`);

        console.log(chalk.yellow('\n🧹 Eliminando/limpiando workspace de producción si existe - (vtex workspace delete production)...'));
        await execCommand('vtex workspace delete production');

        console.log(chalk.yellow('\n🔄 Cambiando a workspace production - (vtex use production --production)...'));
        await execCommand('vtex use production --production');

        console.log(chalk.yellow('\n📦 Publicando app - (vtex publish)...'));
        await execCommand('vtex publish');

        console.log(chalk.yellow('\n🛠️ Ejecutando deploy force - (vtex deploy --force)...'));
        await execCommand('vtex deploy --force');

        console.log(chalk.yellow('\n💾 Actualizando workspace productivo - (vtex update)...'));
        await execCommand('vtex update');

        // Mostrar URL y confirmación
        const productionUrl = `https://production--${this.vendor}.myvtex.com/`;
        console.log(chalk.cyan('\n🌐 Verifica los cambios en:'));
        console.log(chalk.blue(productionUrl));

        const { continuar } = await inquirer.prompt([{
          type: 'confirm',
          name: 'continuar',
          message: '¿Los cambios están correctos y deseas continuar?',
          default: false,
        }]);

        if (!continuar) {
          console.log(chalk.yellow('\nProceso cancelado por el usuario'));
          return;
        }

        console.log(chalk.yellow('\n🔄 Cambiando a workspace master - (vtex use master)...'));
        await execCommand('vtex use master');

        console.log(chalk.yellow('\n💾 Actualizando workspace master - (vtex update)...'));
        await execCommand('vtex update');

        console.log(chalk.green('\n✅ Nueva custom app desplegada exitosamente 🚀'));
      } catch (error) {
        console.error(chalk.red('\n❌ Error durante el deploy de nueva custom app'));
        throw error;
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Error en new custom app:'), error);
      throw error;
    }
  }

  private async executeUpdateCustomApp(): Promise<void> {
    try {
      this.vendor = await this.getVendorFromManifest();
      console.log(chalk.green(`\n🔎 Vendor detectado desde manifest.json: ${this.vendor}`));

      // Verificaciones
      console.log(chalk.blue('\n🔍 Verificando custom app...'));
      if (!(await this.checkCustomAppDirectory() && await this.checkVersionUpdate())) {
        throw new Error('Verificación fallida: directorio o versión incorrectos');
      }

      const spinner = ora('Iniciando actualización de custom app...').start();

      try {
        spinner.stop();
        console.log(chalk.yellow(`\n👤 Iniciando sesión en VTEX - (vtex login ${this.vendor})...`));
        await execCommand(`vtex login ${this.vendor}`);

        console.log(chalk.yellow('\n🧹 Eliminando/limpiando workspace de producción si existe - (vtex workspace delete production)...'));
        await execCommand('vtex workspace delete production');

        console.log(chalk.yellow('\n🔄 Cambiando a workspace production - (vtex use production --production)...'));
        await execCommand('vtex use production --production');

        console.log(chalk.yellow('\n📦 Publicando actualización - (vtex publish)...'));
        await execCommand('vtex publish');

        console.log(chalk.yellow('\n🛠️ Ejecutando deploy force - (vtex deploy --force)...'));
        await execCommand('vtex deploy --force');

        console.log(chalk.yellow('\n💾 Actualizando workspace productivo - (vtex update)...'));
        await execCommand('vtex update');

        // Verificación y confirmación
        const productionUrl = `https://production--${this.vendor}.myvtex.com/`;
        console.log(chalk.cyan('\n🌐 Verifica los cambios en:'));
        console.log(chalk.blue(productionUrl));

        const { continuar } = await inquirer.prompt([{
          type: 'confirm',
          name: 'continuar',
          message: '¿Los cambios están correctos y deseas continuar?',
          default: false,
        }]);

        if (!continuar) {
          console.log(chalk.yellow('\nProceso cancelado por el usuario'));
          return;
        }

        console.log(chalk.yellow('\n🔄 Cambiando a workspace master - (vtex use master)...'));
        await execCommand('vtex use master');

        console.log(chalk.yellow('\n💾 Actualizando workspace master - (vtex update)...'));
        await execCommand('vtex update');

        console.log(chalk.green('\n✅ Custom app actualizada exitosamente 🚀'));
      } catch (error) {
        console.error(chalk.red('\n❌ Error durante la actualización de la custom app'));
        throw error;
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Error en update custom app:'), error);
      throw error;
    }
  }

  private async executeMajorStable(): Promise<void> {
    try {
      this.vendor = await this.getVendorFromManifest();
      console.log(chalk.green(`\n🔎 Vendor detectado desde manifest.json: ${this.vendor}`));

      const spinner = ora('Iniciando major stable...').start();

      try {
        spinner.stop();
        console.log(chalk.yellow(`\n👤 Iniciando sesión en VTEX - (vtex login ${this.vendor})...`));
        await execCommand(`vtex login ${this.vendor}`);

        console.log(chalk.yellow('\n🧹 Eliminando/limpiando workspace de producción si existe - (vtex workspace delete production)...'));
        await execCommand('vtex workspace delete production');

        console.log(chalk.yellow('\n🔄 Cambiando a workspace production - (vtex use production --production)...'));
        await execCommand('vtex use production --production');

        console.log(chalk.yellow('\n🚀 Ejecutando release major stable - (vtex release major stable)...'));
        await execCommand('vtex release major stable');

        console.log(chalk.yellow('\n🔌 Instalando GraphQL IDE - (vtex install vtex.admin-graphql-ide@3.x)...'));
        await execCommand('vtex install vtex.admin-graphql-ide@3.x');

        // Instrucciones para el usuario
        const productionUrl = `https://production--${this.vendor}.myvtex.com/`;
        console.log(chalk.blue('\n🔄 Proceso de migración requerido'));
        console.log(chalk.yellow(`
          1. Accede a: vtex browse admin/graphql-ide
          2. Selecciona vtex.pages-graphql@2.x
          3. Ejecuta la mutation:
            mutation {
              updateThemeIds(from:"${this.vendor}.store@3.x", to:"${this.vendor}.store@4.x")
            }
          4. Verifica que la respuesta sea {"data": {"updateThemeIds": true}}`));

        console.log(chalk.cyan('\n🌐 Verifica los cambios en:'));
        console.log(chalk.blue(productionUrl));

        const { continuar } = await inquirer.prompt([{
          type: 'confirm',
          name: 'continuar',
          message: '¿La migración se completó correctamente y deseas continuar?',
          default: false,
        }]);

        if (!continuar) {
          console.log(chalk.yellow('\nProceso cancelado por el usuario'));
          return;
        }

        console.log(chalk.yellow('\n🚀 Promoviendo cambios - (vtex promote)...'));
        await execCommand('vtex promote');

        console.log(chalk.yellow('\n🔄 Cambiando a workspace master - (vtex use master)...'));
        await execCommand('vtex use master');

        console.log(chalk.yellow('\n💾 Actualizando workspace master - (vtex update)...'));
        await execCommand('vtex update');

        console.log(chalk.green('\n✅ Major stable completado exitosamente 🚀'));
      } catch (error) {
        console.error(chalk.red('\n❌ Error durante el major stable'));
        throw error;
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Error en major stable:'), error);
      throw error;
    }
  }

  async deploy(): Promise<void> {
    try {
      // Ejecutar el tipo de deploy correspondiente
      switch (this.deployType) {
        case 'PATCH_STABLE':
          await this.executePatchStable();
          break;
        case 'NEW_CUSTOM_APP':
          await this.executeNewCustomApp();
          break;
        case 'UPDATE_CUSTOM_APP':
          await this.executeUpdateCustomApp();
          break;
        case 'MAJOR_STABLE':
          await this.executeMajorStable();
          break;
      }
    } catch (error) {
      console.error(chalk.red('❌ Error durante el proceso:'), error);
      throw error;
    }
  }
}

export const createDeploy = (options?: DeployOptions) => {
  return new VtexDeploy(options);
};
