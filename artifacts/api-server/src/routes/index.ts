import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ocrRouter from "./ocr";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/ocr", ocrRouter);

export default router;
