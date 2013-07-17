/*
   miércoles, 17 de julio de 201320:02:13
   User: DB_31755_staging_user
   Server: s09.winhost.com
   Database: DB_31755_staging
   Application: 
*/

/* To prevent any potential data loss issues, you should review this script in detail before running it outside the context of the database designer.*/
BEGIN TRANSACTION
SET QUOTED_IDENTIFIER ON
SET ARITHABORT ON
SET NUMERIC_ROUNDABORT OFF
SET CONCAT_NULL_YIELDS_NULL ON
SET ANSI_NULLS ON
SET ANSI_PADDING ON
SET ANSI_WARNINGS ON
COMMIT
BEGIN TRANSACTION
GO
ALTER TABLE dbo.pricingtype
	DROP CONSTRAINT DF__pricingty__Langu__086B34A6
GO
ALTER TABLE dbo.pricingtype
	DROP CONSTRAINT DF__pricingty__Count__095F58DF
GO
ALTER TABLE dbo.pricingtype
	DROP CONSTRAINT DF__pricingty__Activ__0A537D18
GO
ALTER TABLE dbo.pricingtype
	DROP CONSTRAINT DF__pricingty__Displ__26A5A303
GO
CREATE TABLE dbo.Tmp_pricingtype
	(
	PricingTypeID int NOT NULL,
	LanguageID int NOT NULL,
	CountryID int NOT NULL,
	Description varchar(50) NULL,
	CreatedDate datetime NOT NULL,
	UpdatedDate datetime NOT NULL,
	ModifiedBy varchar(50) NOT NULL,
	Active bit NOT NULL,
	DisplayRank int NOT NULL
	)  ON [PRIMARY]
GO
ALTER TABLE dbo.Tmp_pricingtype SET (LOCK_ESCALATION = TABLE)
GO
ALTER TABLE dbo.Tmp_pricingtype ADD CONSTRAINT
	DF__pricingty__Langu__086B34A6 DEFAULT ((1)) FOR LanguageID
GO
ALTER TABLE dbo.Tmp_pricingtype ADD CONSTRAINT
	DF__pricingty__Count__095F58DF DEFAULT ((1)) FOR CountryID
GO
ALTER TABLE dbo.Tmp_pricingtype ADD CONSTRAINT
	DF__pricingty__Activ__0A537D18 DEFAULT ((1)) FOR Active
GO
ALTER TABLE dbo.Tmp_pricingtype ADD CONSTRAINT
	DF__pricingty__Displ__26A5A303 DEFAULT ((0)) FOR DisplayRank
GO
IF EXISTS(SELECT * FROM dbo.pricingtype)
	 EXEC('INSERT INTO dbo.Tmp_pricingtype (PricingTypeID, LanguageID, CountryID, Description, CreatedDate, UpdatedDate, ModifiedBy, Active, DisplayRank)
		SELECT PricingTypeID, LanguageID, CountryID, Description, CreatedDate, UpdatedDate, ModifiedBy, Active, DisplayRank FROM dbo.pricingtype WITH (HOLDLOCK TABLOCKX)')
GO
ALTER TABLE dbo.positionpricingtype
	DROP CONSTRAINT Fk_positionpricingtype
GO
ALTER TABLE dbo.pricingestimate
	DROP CONSTRAINT Fk_pricingestimate
GO
DROP TABLE dbo.pricingtype
GO
EXECUTE sp_rename N'dbo.Tmp_pricingtype', N'pricingtype', 'OBJECT' 
GO
ALTER TABLE dbo.pricingtype ADD CONSTRAINT
	PK_pricingtype_PricingTypeID PRIMARY KEY CLUSTERED 
	(
	PricingTypeID,
	LanguageID,
	CountryID
	) WITH( PAD_INDEX = OFF, FILLFACTOR = 100, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]

GO
ALTER TABLE dbo.pricingtype ADD CONSTRAINT
	Pk_pricingtype UNIQUE NONCLUSTERED 
	(
	PricingTypeID
	) WITH( STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]

GO
COMMIT
select Has_Perms_By_Name(N'dbo.pricingtype', 'Object', 'ALTER') as ALT_Per, Has_Perms_By_Name(N'dbo.pricingtype', 'Object', 'VIEW DEFINITION') as View_def_Per, Has_Perms_By_Name(N'dbo.pricingtype', 'Object', 'CONTROL') as Contr_Per BEGIN TRANSACTION
GO
ALTER TABLE dbo.pricingestimate WITH NOCHECK ADD CONSTRAINT
	Fk_pricingestimate FOREIGN KEY
	(
	PricingTypeID
	) REFERENCES dbo.pricingtype
	(
	PricingTypeID
	) ON UPDATE  NO ACTION 
	 ON DELETE  NO ACTION 
	
GO
ALTER TABLE dbo.pricingestimate
	NOCHECK CONSTRAINT Fk_pricingestimate
GO
ALTER TABLE dbo.pricingestimate SET (LOCK_ESCALATION = TABLE)
GO
COMMIT
select Has_Perms_By_Name(N'dbo.pricingestimate', 'Object', 'ALTER') as ALT_Per, Has_Perms_By_Name(N'dbo.pricingestimate', 'Object', 'VIEW DEFINITION') as View_def_Per, Has_Perms_By_Name(N'dbo.pricingestimate', 'Object', 'CONTROL') as Contr_Per BEGIN TRANSACTION
GO
ALTER TABLE dbo.positionpricingtype WITH NOCHECK ADD CONSTRAINT
	Fk_positionpricingtype FOREIGN KEY
	(
	PricingTypeID,
	LanguageID,
	CountryID
	) REFERENCES dbo.pricingtype
	(
	PricingTypeID,
	LanguageID,
	CountryID
	) ON UPDATE  NO ACTION 
	 ON DELETE  NO ACTION 
	
GO
ALTER TABLE dbo.positionpricingtype
	NOCHECK CONSTRAINT Fk_positionpricingtype
GO
ALTER TABLE dbo.positionpricingtype SET (LOCK_ESCALATION = TABLE)
GO
COMMIT
select Has_Perms_By_Name(N'dbo.positionpricingtype', 'Object', 'ALTER') as ALT_Per, Has_Perms_By_Name(N'dbo.positionpricingtype', 'Object', 'VIEW DEFINITION') as View_def_Per, Has_Perms_By_Name(N'dbo.positionpricingtype', 'Object', 'CONTROL') as Contr_Per 