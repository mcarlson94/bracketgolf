import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import tournamentRouter from "./tournament";
import bracketsRouter from "./brackets";
import leaderboardRouter from "./leaderboard";
import groupsRouter from "./groups";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(tournamentRouter);
router.use(bracketsRouter);
router.use(leaderboardRouter);
router.use(groupsRouter);
router.use(adminRouter);

export default router;
