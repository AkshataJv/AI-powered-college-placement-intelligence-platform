"""Company and eligibility criteria endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user, require_tp_cell
from app.models.company import Company, CompanyCriteria
from app.models.user import User
from app.schemas.company import CompanyCreate, CompanyResponse, CompanyUpdate

router = APIRouter(prefix="/api/companies", tags=["Companies"])


@router.get("", response_model=list[CompanyResponse])
def list_companies(_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[CompanyResponse]:
    companies = db.query(Company).options(joinedload(Company.criteria)).order_by(Company.created_at.desc()).all()
    return [CompanyResponse.model_validate(company) for company in companies]


@router.get("/{company_id}", response_model=CompanyResponse)
def get_company(company_id: int, _user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> CompanyResponse:
    company = db.query(Company).options(joinedload(Company.criteria)).filter(Company.id == company_id).first()
    if company is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company was not found.")
    return CompanyResponse.model_validate(company)


@router.post("", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
def create_company(payload: CompanyCreate, _user: User = Depends(require_tp_cell), db: Session = Depends(get_db)) -> CompanyResponse:
    data = payload.model_dump(exclude={"criteria"})
    company = Company(**data)
    if payload.criteria is not None:
        company.criteria = CompanyCriteria(**payload.criteria.model_dump())
    db.add(company)
    db.commit()
    db.refresh(company)
    return CompanyResponse.model_validate(company)


@router.put("/{company_id}", response_model=CompanyResponse)
def update_company(
    company_id: int,
    payload: CompanyUpdate,
    _user: User = Depends(require_tp_cell),
    db: Session = Depends(get_db),
) -> CompanyResponse:
    company = db.query(Company).options(joinedload(Company.criteria)).filter(Company.id == company_id).first()
    if company is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company was not found.")
    changes = payload.model_dump(exclude_unset=True)
    criteria_changes = changes.pop("criteria", None)
    for field, value in changes.items():
        setattr(company, field, value)
    if criteria_changes is not None:
        if company.criteria is None:
            company.criteria = CompanyCriteria(**criteria_changes)
        else:
            for field, value in criteria_changes.items():
                setattr(company.criteria, field, value)
    db.commit()
    db.refresh(company)
    return CompanyResponse.model_validate(company)


@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_company(company_id: int, _user: User = Depends(require_tp_cell), db: Session = Depends(get_db)) -> None:
    company = db.get(Company, company_id)
    if company is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company was not found.")
    db.delete(company)
    db.commit()