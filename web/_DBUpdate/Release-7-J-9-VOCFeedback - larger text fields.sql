/*
   martes, 19 de mayo de 201516:55:46
   User: 
   Server: localhost\SQLEXPRESS
   Database: loconomics
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
CREATE TABLE dbo.Tmp_VOCFeedback
	(
	VOCFeedbackID int NOT NULL IDENTITY (1, 1),
	VOCElementID int NOT NULL,
	VOCExperienceCategoryID int NOT NULL,
	UserID int NOT NULL,
	Feedback text NOT NULL,
	VOCFlag1 varchar(50) NULL,
	VOCFlag2 varchar(50) NULL,
	VOCFlag3 varchar(50) NULL,
	VOCFlag4 varchar(50) NULL,
	UserDevice text NULL,
	ZenDeskTicketNumber int NULL,
	ProviderUserID int NULL,
	ProviderPositionID int NULL,
	CreatedDate datetime NOT NULL,
	UpdatedDate datetime NOT NULL,
	ModifiedBy varchar(3) NOT NULL
	)  ON [PRIMARY]
	 TEXTIMAGE_ON [PRIMARY]
GO
ALTER TABLE dbo.Tmp_VOCFeedback SET (LOCK_ESCALATION = TABLE)
GO
SET IDENTITY_INSERT dbo.Tmp_VOCFeedback ON
GO
IF EXISTS(SELECT * FROM dbo.VOCFeedback)
	 EXEC('INSERT INTO dbo.Tmp_VOCFeedback (VOCFeedbackID, VOCElementID, VOCExperienceCategoryID, UserID, Feedback, VOCFlag1, VOCFlag2, VOCFlag3, VOCFlag4, UserDevice, ZenDeskTicketNumber, ProviderUserID, ProviderPositionID, CreatedDate, UpdatedDate, ModifiedBy)
		SELECT VOCFeedbackID, VOCElementID, VOCExperienceCategoryID, UserID, CONVERT(text, Feedback), VOCFlag1, VOCFlag2, VOCFlag3, VOCFlag4, CONVERT(text, UserDevice), ZenDeskTicketNumber, ProviderUserID, ProviderPositionID, CreatedDate, UpdatedDate, ModifiedBy FROM dbo.VOCFeedback WITH (HOLDLOCK TABLOCKX)')
GO
SET IDENTITY_INSERT dbo.Tmp_VOCFeedback OFF
GO
DROP TABLE dbo.VOCFeedback
GO
EXECUTE sp_rename N'dbo.Tmp_VOCFeedback', N'VOCFeedback', 'OBJECT' 
GO
ALTER TABLE dbo.VOCFeedback ADD CONSTRAINT
	PK__VOCFeedb__B6FF22780B528E49 PRIMARY KEY CLUSTERED 
	(
	VOCFeedbackID
	) WITH( STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]

GO
COMMIT
select Has_Perms_By_Name(N'dbo.VOCFeedback', 'Object', 'ALTER') as ALT_Per, Has_Perms_By_Name(N'dbo.VOCFeedback', 'Object', 'VIEW DEFINITION') as View_def_Per, Has_Perms_By_Name(N'dbo.VOCFeedback', 'Object', 'CONTROL') as Contr_Per 