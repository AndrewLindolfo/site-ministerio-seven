import { exportBackupJson } from "../services/backup-service.js";
import { restoreBackupJson } from "../services/restore-service.js";
import { explainFirebaseError } from "../db.js";
import { recordAdminActivity } from "../services/admin-activity-service.js";

function downloadJsonFile(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildRestoreMessage(summary) {
  const restoredEntries = Object.entries(summary.restored || {}).filter(([, count]) => count > 0);
  const restoredText = restoredEntries.length
    ? restoredEntries.map(([name, count]) => `${name}: ${count}`).join("\n")
    : "Nenhum item foi restaurado.";

  const warningsText = Array.isArray(summary.warnings) && summary.warnings.length
    ? `\n\nAvisos:\n- ${summary.warnings.join("\n- ")}`
    : "";

  return `Backup restaurado.\n\nItens restaurados:\n${restoredText}${warningsText}`;
}

document.addEventListener("DOMContentLoaded", () => {
  const exportButton = document.getElementById("backup-export-button");
  const restoreButton = document.getElementById("backup-restore-button");
  const input = document.getElementById("backup-restore-input");
  const fileName = document.getElementById("backup-file-name");

  input?.addEventListener("change", () => {
    const file = input.files?.[0];
    if (fileName) {
      fileName.textContent = file ? file.name : "Nenhum arquivo selecionado";
    }
  });

  exportButton?.addEventListener("click", async () => {
    try {
      exportButton.disabled = true;
      const data = await exportBackupJson();
      const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
      downloadJsonFile(data, `ministerio-seven-backup-${stamp}.json`);
      await recordAdminActivity({ action: "export", module: "backup", itemId: stamp, itemName: `Backup ${stamp}`, details: "Backup exportado pelo painel administrativo." });
      alert("Backup gerado com sucesso.");
    } catch (error) {
      console.error("Erro ao fazer backup:", error);
      alert(`Não foi possível gerar o backup.\n\n${explainFirebaseError(error)}`);
    } finally {
      exportButton.disabled = false;
    }
  });

  restoreButton?.addEventListener("click", async () => {
    try {
      const file = input?.files?.[0];
      if (!file) {
        alert("Selecione um arquivo de backup primeiro.");
        return;
      }

      if (!confirm("Deseja recuperar este backup? Isso vai restaurar os itens do arquivo no Firebase.")) {
        return;
      }

      restoreButton.disabled = true;
      const text = await file.text();
      const json = JSON.parse(text);
      const summary = await restoreBackupJson(json);
      await recordAdminActivity({ action: "import", module: "backup", itemId: file.name, itemName: file.name, details: "Backup restaurado pelo painel administrativo." });
      alert(buildRestoreMessage(summary));
    } catch (error) {
      console.error("Erro ao restaurar backup:", error);
      alert(`Não foi possível restaurar o backup.\n\n${error?.message || explainFirebaseError(error)}`);
    } finally {
      restoreButton.disabled = false;
    }
  });
});
