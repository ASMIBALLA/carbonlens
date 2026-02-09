/**
 * Autonomous Optimization Agent
 * Self-optimizing system that monitors and acts automatically
 */

import { Supplier } from '../types';
import { CarbonRiskAlert, detectCarbonRisks } from '../prediction/carbonRisk';
import { optimizeRoute, RouteOptimizationResult } from './routeOptimizer';
import { OptimizationSolution, optimizeSupplierMix, DEFAULT_OPTIMIZATION_CONFIG } from './multiObjective';
import { optimizeSupplierDestinations } from "./matrixOptimizer";

export interface AgentConfig {
  enabled: boolean;
  autoExecuteThreshold: number; // Confidence threshold for auto-execution (0-1)
  minEmissionReduction: number; // Minimum tons CO2e to trigger action
  checkIntervalMinutes: number;
  notifyOnActions: boolean;
  requireHumanApproval: boolean;
}

export interface AgentAction {
  id: string;
  timestamp: Date;
  type: 'route_change' | 'supplier_switch' | 'transport_mode_change' | 'alert';
  supplier: Supplier;
  trigger: string;
  action: string;
  emissionImpact: number;
  costImpact: number;
  confidence: number;
  autoExecuted: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
  humanApprovalRequired: boolean;
  executionLog?: string;
}

export interface AgentState {
  running: boolean;
  lastCheckTime: Date | null;
  actionsExecuted: number;
  emissionsSaved: number;
  pendingApprovals: AgentAction[];
  executionHistory: AgentAction[];
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  enabled: false,
  autoExecuteThreshold: 0.9, // 90% confidence required
  minEmissionReduction: 50, // 50 tons minimum
  checkIntervalMinutes: 60, // Check every hour
  notifyOnActions: true,
  requireHumanApproval: true, // Safe default
};

/**
 * Agent state management
 */
class OptimizationAgent {
  private config: AgentConfig;
  private state: AgentState;
  private suppliers: Supplier[];

  constructor(suppliers: Supplier[], config: AgentConfig = DEFAULT_AGENT_CONFIG) {
    this.suppliers = suppliers;
    this.config = config;
    this.state = {
      running: false,
      lastCheckTime: null,
      actionsExecuted: 0,
      emissionsSaved: 0,
      pendingApprovals: [],
      executionHistory: [],
    };
  }

  /**
   * Main agent loop
   */
  async run(): Promise<void> {
    if (!this.config.enabled) {
      console.log('Agent is disabled');
      return;
    }

    this.state.running = true;
    console.log('Autonomous optimization agent started');

    while (this.state.running) {
      try {
        await this.executeCycle();
        this.state.lastCheckTime = new Date();

        // Wait for next cycle
        await this.sleep(this.config.checkIntervalMinutes * 60 * 1000);
      } catch (error) {
        console.error('Agent cycle error:', error);
        // Continue running even if one cycle fails
      }
    }
  }

  /**
   * Execute one optimization cycle
   */
  private async executeCycle(): Promise<void> {
    console.log(`Agent cycle starting at ${new Date().toISOString()}`);

    // Step 1: Detect risks
    const risks = await detectCarbonRisks(this.suppliers);
    console.log(`Detected ${risks.length} carbon risks`);

    // Step 2: Find optimization opportunities
    const opportunities = await this.findOptimizations(risks);
    console.log(`Found ${opportunities.length} optimization opportunities`);

    // Step 3: Evaluate and execute
    for (const action of opportunities) {
      if (this.shouldAutoExecute(action)) {
        await this.executeAction(action);
      } else {
        await this.requestApproval(action);
      }
    }

    // Step 4: Process pending approvals
    await this.processPendingApprovals();

    console.log(`Agent cycle complete. Actions executed: ${this.state.actionsExecuted}`);
  }

  /**
   * Find optimization opportunities based on risks
   */
  private async findOptimizations(risks: CarbonRiskAlert[]): Promise<AgentAction[]> {
    const actions: AgentAction[] = [];

    for (const risk of risks) {
      // Check if emission impact is significant
      if (risk.emissionDelta < this.config.minEmissionReduction) {
        continue;
      }

      // Find route optimizations
      const routeOpt = await optimizeRoute(risk.supplier, 'emissions');

      if (routeOpt.emissionSavings > this.config.minEmissionReduction) {
        actions.push({
          id: `ACT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
          type: 'route_change',
          supplier: risk.supplier,
          trigger: risk.reason,
          action: routeOpt.reason,
          emissionImpact: -routeOpt.emissionSavings,
          costImpact: routeOpt.costImpact,
          confidence: risk.confidence.score,
          autoExecuted: false,
          status: 'pending',
          humanApprovalRequired: this.config.requireHumanApproval,
        });
      }

      // Check for transport mode changes
      if (risk.supplier.transportMode === 'air') {
        const potentialSavings = risk.supplier.totalEmissions * 0.65; // 65% savings from air->sea

        actions.push({
          id: `ACT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
          type: 'transport_mode_change',
          supplier: risk.supplier,
          trigger: 'High emission transport mode detected',
          action: `Switch from air to sea freight for ${risk.supplier.name}`,
          emissionImpact: -potentialSavings,
          costImpact: -risk.supplier.annualSpend * 0.15, // 15% cost savings
          confidence: 0.85,
          autoExecuted: false,
          status: 'pending',
          humanApprovalRequired: this.config.requireHumanApproval,
        });
      }
    }

    return actions;
  }

  /**
   * Determine if action should be auto-executed
   */
  private shouldAutoExecute(action: AgentAction): boolean {
    if (this.config.requireHumanApproval) {
      return false;
    }

    return (
      action.confidence >= this.config.autoExecuteThreshold &&
      Math.abs(action.emissionImpact) >= this.config.minEmissionReduction
    );
  }

  /**
   * Execute an optimization action
   */
  private async executeAction(action: AgentAction): Promise<void> {
    console.log(`Executing action: ${action.id}`);

    try {
      // Simulate execution (in production, this would call logistics APIs)
      await this.sleep(1000);

      action.status = 'executed';
      action.autoExecuted = true;
      action.executionLog = `Auto-executed at ${new Date().toISOString()}`;

      this.state.actionsExecuted++;
      this.state.emissionsSaved += Math.abs(action.emissionImpact);
      this.state.executionHistory.push(action);

      if (this.config.notifyOnActions) {
        await this.notifyStakeholders(action);
      }

      console.log(`Action executed successfully: ${action.emissionImpact.toFixed(2)} tons CO2e saved`);
    } catch (error) {
      console.error(`Action execution failed:`, error);
      action.status = 'failed';
      action.executionLog = `Failed: ${error}`;
    }
  }

  /**
   * Request human approval for action
   */
  private async requestApproval(action: AgentAction): Promise<void> {
    console.log(`Requesting approval for action: ${action.id}`);
    action.status = 'pending';
    this.state.pendingApprovals.push(action);

    if (this.config.notifyOnActions) {
      await this.notifyStakeholders(action);
    }
  }

  /**
   * Process pending approvals
   */
  private async processPendingApprovals(): Promise<void> {
    // In production, this would check an approval queue/database
    // For now, we'll simulate some approvals
    const toProcess = [...this.state.pendingApprovals];

    for (const action of toProcess) {
      // Simulate: auto-approve high-confidence, low-cost actions after 24 hours
      const hoursWaiting = (Date.now() - action.timestamp.getTime()) / (1000 * 60 * 60);

      if (hoursWaiting > 24 && action.confidence > 0.8 && action.costImpact < 10000) {
        action.status = 'approved';
        await this.executeAction(action);

        const index = this.state.pendingApprovals.indexOf(action);
        if (index > -1) {
          this.state.pendingApprovals.splice(index, 1);
        }
      }
    }
  }

  /**
   * Notify stakeholders of actions
   */
  private async notifyStakeholders(action: AgentAction): Promise<void> {
    // In production, this would send emails/Slack messages
    console.log(`[NOTIFICATION] ${action.status.toUpperCase()}: ${action.action}`);
    console.log(`  Emission Impact: ${action.emissionImpact.toFixed(2)} tons CO2e`);
    console.log(`  Cost Impact: $${action.costImpact.toLocaleString()}`);
    console.log(`  Confidence: ${(action.confidence * 100).toFixed(1)}%`);
  }

  /**
   * Utility: Sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Stop the agent
   */
  stop(): void {
    this.state.running = false;
    console.log('Agent stopped');
  }

  /**
   * Get current state
   */
  getState(): AgentState {
    return { ...this.state };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Agent configuration updated');
  }

  /**
   * Approve a pending action
   */
  async approveAction(actionId: string): Promise<void> {
    const action = this.state.pendingApprovals.find(a => a.id === actionId);
    if (action) {
      action.status = 'approved';
      await this.executeAction(action);

      const index = this.state.pendingApprovals.indexOf(action);
      if (index > -1) {
        this.state.pendingApprovals.splice(index, 1);
      }
    }
  }

  /**
   * Reject a pending action
   */
  rejectAction(actionId: string): void {
    const action = this.state.pendingApprovals.find(a => a.id === actionId);
    if (action) {
      action.status = 'rejected';

      const index = this.state.pendingApprovals.indexOf(action);
      if (index > -1) {
        this.state.pendingApprovals.splice(index, 1);
      }

      this.state.executionHistory.push(action);
    }
  }
}

/**
 * Create and configure agent instance
 */
export function createOptimizationAgent(
  suppliers: Supplier[],
  config?: Partial<AgentConfig>
): OptimizationAgent {
  const fullConfig = { ...DEFAULT_AGENT_CONFIG, ...config };
  return new OptimizationAgent(suppliers, fullConfig);
}

export { OptimizationAgent };