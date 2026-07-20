import TestIndex from "./api/test/index.js";
import TestRequest from "./api/test/request.js";
import UserAccountVerification from "./api/user.accountVerification.js";
import Admin from "./api/admin/admin";
export const routerIndex = {
  "/api/test/index": TestIndex,
  "/api/test/request": TestRequest,
  "/api/user": UserAccountVerification,
  "/api/admin": Admin,
};

// export default router;
export default routerIndex;