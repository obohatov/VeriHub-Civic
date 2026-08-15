import type { Express } from "express";
import { createServer, type Server } from "http";
import { initializeStorage, storage } from "./storage";
import { runAudit } from "./services/auditRunner";
import { insertFactSchema, insertAuditRunSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Initialize database and seed data
  await initializeStorage();

  // ============== DASHBOARD ==============
  app.get("/api/dashboard/metrics", async (req, res) => {
    try {
      const metrics = await storage.getDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error getting dashboard metrics:", error);
      res.status(500).json({ error: "Failed to get dashboard metrics" });
    }
  });

  // ============== FACTS ==============
  app.get("/api/facts", async (req, res) => {
    try {
      const facts = await storage.getFacts();
      res.json(facts);
    } catch (error) {
      console.error("Error getting facts:", error);
      res.status(500).json({ error: "Failed to get facts" });
    }
  });

  app.get("/api/facts/search", async (req, res) => {
    try {
      const query = req.query.q as string || "";
      const facts = await storage.searchFacts(query);
      res.json(facts);
    } catch (error) {
      console.error("Error searching facts:", error);
      res.status(500).json({ error: "Failed to search facts" });
    }
  });

  app.get("/api/facts/:id", async (req, res) => {
    try {
      const fact = await storage.getFact(req.params.id);
      if (!fact) {
        return res.status(404).json({ error: "Fact not found" });
      }
      res.json(fact);
    } catch (error) {
      console.error("Error getting fact:", error);
      res.status(500).json({ error: "Failed to get fact" });
    }
  });

  app.post("/api/facts", async (req, res) => {
    try {
      const parsed = insertFactSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid fact data", details: parsed.error });
      }
      const fact = await storage.createFact(parsed.data);
      res.status(201).json(fact);
    } catch (error) {
      console.error("Error creating fact:", error);
      res.status(500).json({ error: "Failed to create fact" });
    }
  });

  app.put("/api/facts/:id", async (req, res) => {
    try {
      const fact = await storage.updateFact(req.params.id, req.body);
      if (!fact) {
        return res.status(404).json({ error: "Fact not found" });
      }
      res.json(fact);
    } catch (error) {
      console.error("Error updating fact:", error);
      res.status(500).json({ error: "Failed to update fact" });
    }
  });

  app.delete("/api/facts/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteFact(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Fact not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting fact:", error);
      res.status(500).json({ error: "Failed to delete fact" });
    }
  });

  // ============== QUESTION SETS ==============
  app.get("/api/question-sets", async (req, res) => {
    try {
      const questionSets = await storage.getQuestionSets();
      res.json(questionSets);
    } catch (error) {
      console.error("Error getting question sets:", error);
      res.status(500).json({ error: "Failed to get question sets" });
    }
  });

  app.get("/api/question-sets/:id", async (req, res) => {
    try {
      const questionSet = await storage.getQuestionSet(req.params.id);
      if (!questionSet) {
        return res.status(404).json({ error: "Question set not found" });
      }
      res.json(questionSet);
    } catch (error) {
      console.error("Error getting question set:", error);
      res.status(500).json({ error: "Failed to get question set" });
    }
  });

  // ============== QUESTIONS ==============
  app.get("/api/questions", async (req, res) => {
    try {
      const questions = await storage.getQuestions();
      res.json(questions);
    } catch (error) {
      console.error("Error getting questions:", error);
      res.status(500).json({ error: "Failed to get questions" });
    }
  });

  app.get("/api/questions/:id", async (req, res) => {
    try {
      const question = await storage.getQuestion(req.params.id);
      if (!question) {
        return res.status(404).json({ error: "Question not found" });
      }
      res.json(question);
    } catch (error) {
      console.error("Error getting question:", error);
      res.status(500).json({ error: "Failed to get question" });
    }
  });

  // ============== AUDIT RUNS ==============
  app.get("/api/audit-runs", async (req, res) => {
    try {
      const auditRuns = await storage.getAuditRuns();
      res.json(auditRuns);
    } catch (error) {
      console.error("Error getting audit runs:", error);
      res.status(500).json({ error: "Failed to get audit runs" });
    }
  });

  app.get("/api/audit-runs/:id", async (req, res) => {
    try {
      const auditRun = await storage.getAuditRun(req.params.id);
      if (!auditRun) {
        return res.status(404).json({ error: "Audit run not found" });
      }
      res.json(auditRun);
    } catch (error) {
      console.error("Error getting audit run:", error);
      res.status(500).json({ error: "Failed to get audit run" });
    }
  });

  app.post("/api/audit-runs", async (req, res) => {
    try {
      const parsed = insertAuditRunSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid audit run data", details: parsed.error });
      }

      // Create the audit run
      const auditRun = await storage.createAuditRun(parsed.data);

      // Run the audit asynchronously
      runAudit(auditRun.id, parsed.data.repetitions ?? 3).catch((error) => {
        console.error("Audit run failed:", error);
      });

      res.status(201).json(auditRun);
    } catch (error) {
      console.error("Error creating audit run:", error);
      res.status(500).json({ error: "Failed to create audit run" });
    }
  });

  app.get("/api/audit-runs/:id/findings", async (req, res) => {
    try {
      const findings = await storage.getFindingsByRun(req.params.id);
      res.json(findings);
    } catch (error) {
      console.error("Error getting findings:", error);
      res.status(500).json({ error: "Failed to get findings" });
    }
  });

  // ============== FINDINGS ==============
  app.get("/api/findings", async (req, res) => {
    try {
      const findings = await storage.getFindings();
      res.json(findings);
    } catch (error) {
      console.error("Error getting findings:", error);
      res.status(500).json({ error: "Failed to get findings" });
    }
  });

  // ============== COMPARISON ==============
  app.get("/api/comparison/:baselineId/:currentId", async (req, res) => {
    try {
      const comparison = await storage.getComparison(
        req.params.baselineId,
        req.params.currentId
      );
      if (!comparison) {
        return res.status(404).json({ error: "Could not generate comparison" });
      }
      res.json(comparison);
    } catch (error) {
      console.error("Error getting comparison:", error);
      res.status(500).json({ error: "Failed to get comparison" });
    }
  });

  return httpServer;
}
