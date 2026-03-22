/**
 * 🏛️ ARQUITETURA: MVC - Model (Cache Semântico)
 * DECISÃO TÉCNICA: Banco SQLite rápido e local (armazenado nos dados de app do usuário).
 * Ao receber uma chamada exatamente igual nas horas seguintes, o sistema bypassa o LLM e devolve na hora.
 * Isso gera economia EXTREMA de tokens e zera a latência!
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');

class CacheModel {
    static init() {
        // Salva na pasta nativa de UserData do S.O (App Data, Roaming, etc)
        const dbPath = path.join(app.getPath('userData'), 'tokenguard_cache.db');
        this.db = new sqlite3.Database(dbPath);
        
        // Cria a tabela caso seja a primeira vez que o usuário executa
        this.db.run(`CREATE TABLE IF NOT EXISTS api_cache (
            hash_key TEXT PRIMARY KEY,
            response TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        console.log("💾 SQLite Cache inicializado em:", dbPath);
    }

    /**
     * Gera uma assinatura SHA-256 baseada no código/pergunta. 
     */
    static generateHash(payload) {
        // Foca nas mensagens (a conversa exata) para bater com o cache
        return crypto.createHash('sha256')
            .update(JSON.stringify(payload.messages || {}))
            .digest('hex');
    }

    /**
     * Verifica no SQLite se já temos essa resposta salva.
     */
    static get(payload) {
        return new Promise((resolve, reject) => {
            const hash = this.generateHash(payload);
            const query = "SELECT response FROM api_cache WHERE hash_key = ?";
            
            this.db.get(query, [hash], (err, row) => {
                if (err) {
                    console.error("Erro ao ler cache:", err);
                    return resolve(null); // Resolve vazio se der erro, pra continuar pra API em vez de travar
                }
                if (row) {
                    // Resposta CADASTRADA no Cache encontrada! BINGO!
                    console.log("⚡ [CACHE HIT] Economia monstra acionada!");
                    return resolve(JSON.parse(row.response));
                }
                resolve(null);
            });
        });
    }

    /**
     * Salva a resposta nova do provedor de IA no SQLite para futuras consultas iguais.
     */
    static save(payload, response) {
        return new Promise((resolve, reject) => {
            const hash = this.generateHash(payload);
            const stmt = this.db.prepare("INSERT OR REPLACE INTO api_cache (hash_key, response) VALUES (?, ?)");
            
            stmt.run([hash, JSON.stringify(response)], (err) => {
                if (err) {
                    console.error("Erro ao salvar cache:", err);
                    return reject(err);
                }
                stmt.finalize();
                console.log("📥 [CACHE SAVED] Nova requisição guardada no SSD.");
                resolve();
            });
        });
    }

    /**
     * Limpa todo o cache do SQLite (chamado via botão do Dashboard).
     */
    static clear() {
        return new Promise((resolve, reject) => {
            this.db.run("DELETE FROM api_cache", (err) => {
                if (err) {
                    console.error("Erro ao limpar cache:", err);
                    return reject(err);
                }
                console.log("🗑️ [CACHE CLEARED] Todo o cache foi removido.");
                resolve();
            });
        });
    }
}

module.exports = CacheModel;
