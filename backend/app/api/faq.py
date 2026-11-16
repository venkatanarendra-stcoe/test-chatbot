from fastapi import APIRouter, Depends, Query

from app.auth.dependencies import Principal, get_current_user
from app.services import knowledge

router = APIRouter(prefix="/api")


@router.get("/faq")
def faq(q: str = Query("", max_length=300), _: Principal = Depends(get_current_user)):
    return {"results": knowledge.search_faq(q)}
