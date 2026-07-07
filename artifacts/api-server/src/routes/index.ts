import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ppdRouter from "./ppd";
import chatRouter from "./chat";
import researchRouter from "./research";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ppdRouter);
router.use(chatRouter);
router.use(researchRouter);

export default router;
